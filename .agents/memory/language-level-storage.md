---
name: Language-level storage
description: Stable persisted values and localized labels for the application language-level selector.
---

Language-level option labels are localized, but their saved values must stay the universal CEFR codes (`A1`–`C2`) or the established `Muttersprache` sentinel.

**Why:** The wizard and existing documents persist those stable values. Persisting a translated label makes existing values appear unselected in other UI languages and can cause users to overwrite them accidentally.

**How to apply:** When changing language-level UI in the wizard, editor, imports, or exports, translate only the displayed label. Normalize older verbose saved values to their CEFR code for selection without rewriting the original data until a user changes it.