import fitz, os
pdf='attached_assets/Spezifikation_Bewerbungs-KI-App_1786488355077.pdf'
outdir='.agents/outputs'
doc=fitz.open(pdf)
print('pages', doc.page_count)
for i, page in enumerate(doc):
    pix=page.get_pixmap(matrix=fitz.Matrix(1.5,1.5), alpha=False)
    out=f'{outdir}/spec-page-{i+1}.png'
    pix.save(out)
    print(out)
