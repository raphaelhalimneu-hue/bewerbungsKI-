import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./context/AuthContext";
import i18n, { updateLocaleHead } from "./i18n";
import { appBase, appPath, pathLang, pathForLang } from "./lib/basePath";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Wizard from "@/pages/Wizard";
import Documents from "@/pages/Documents";
import Preview from "@/pages/Preview";
import CVEditor from "@/pages/CVEditor";
import Pricing from "@/pages/Pricing";
import Scanner from "@/pages/Scanner";
import ImportPage from "@/pages/Import";
import Admin from "@/pages/Admin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

// The URL is authoritative for the language: /tr/... renders Turkish,
// unprefixed URLs are German. Visitors whose stored/browser language is not
// German get redirected once to their language's URL.
const urlLang = pathLang();
let redirecting = false;
if (urlLang) {
  if (i18n.resolvedLanguage !== urlLang) i18n.changeLanguage(urlLang);
} else {
  const detected = i18n.resolvedLanguage || "de";
  if (detected !== "de") {
    redirecting = true;
    window.location.replace(appBase + pathForLang(detected, appPath()) + window.location.search);
  } else if (i18n.resolvedLanguage !== "de") {
    i18n.changeLanguage("de");
  }
}

// Internal, login-only pages must not appear in Google results.
const NOINDEX_PREFIXES = ["/wizard", "/documents", "/preview", "/scanner", "/import", "/admin"];

function syncRobotsMeta(location: string) {
  const noindex = NOINDEX_PREFIXES.some(p => location === p || location.startsWith(p + "/"));
  let meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (noindex) {
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex, nofollow");
  } else if (meta) {
    meta.remove();
  }
}

/** Keeps canonical/hreflang/title/robots in sync with route changes. */
function LocaleHeadSync() {
  const [location] = useLocation();
  useEffect(() => { updateLocaleHead(); syncRobotsMeta(location); }, [location]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/wizard" component={Wizard} />
      <Route path="/documents" component={Documents} />
      <Route path="/preview/:id" component={Preview} />
      <Route path="/documents/:id/edit" component={CVEditor} />
      <Route path="/scanner" component={Scanner} />
      <Route path="/import" component={ImportPage} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  if (redirecting) return null;
  const base = urlLang ? `${appBase}/${urlLang}` : appBase;
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={base}>
            <LocaleHeadSync />
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
