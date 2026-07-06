"""Accounting PDF generation with reportlab."""
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle


BRAND = colors.HexColor("#7FA9A8")
DARK = colors.HexColor("#1A1C18")


def build_accounting_pdf(month: int, year: int, orders: list, restaurant_name: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("t", parent=styles["Heading1"], textColor=DARK, fontSize=22, spaceAfter=6)
    sub_style = ParagraphStyle("s", parent=styles["Normal"], textColor=colors.HexColor("#5C6057"), fontSize=10, spaceAfter=18)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=BRAND, fontSize=13, spaceBefore=16, spaceAfter=8)

    story = []
    story.append(Paragraph(f"{restaurant_name} — Comptabilité", title_style))
    story.append(Paragraph(f"Période : {month:02d}/{year} · Généré le {datetime.now().strftime('%d.%m.%Y %H:%M')}", sub_style))

    # Totals by VAT rate
    net_by_vat: dict = {}
    vat_by_vat: dict = {}
    gross = 0.0
    product_qty: dict = {}

    for o in orders:
        rate = o.get("vat_rate", 0.026)
        net_by_vat[rate] = net_by_vat.get(rate, 0.0) + o.get("subtotal", 0.0) - o.get("discount_amount", 0.0)
        vat_by_vat[rate] = vat_by_vat.get(rate, 0.0) + o.get("vat_amount", 0.0)
        gross += o.get("total", 0.0)
        for it in o.get("items", []):
            product_qty[it["name"]] = product_qty.get(it["name"], 0) + it["quantity"]

    net = sum(net_by_vat.values())
    vat_total = sum(vat_by_vat.values())

    story.append(Paragraph("Synthèse", h2))
    summary = [
        ["Chiffre d'affaires brut (TTC)", f"CHF {gross:.2f}"],
        ["CA net (HT)", f"CHF {net:.2f}"],
        ["TVA totale", f"CHF {vat_total:.2f}"],
        ["Nombre de commandes", str(len(orders))],
    ]
    t = Table(summary, colWidths=[9 * cm, 7 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F5F2EA")),
        ("TEXTCOLOR", (0, 0), (-1, -1), DARK),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#DDDDDD")),
    ]))
    story.append(t)

    story.append(Paragraph("TVA détaillée par taux", h2))
    vat_rows = [["Taux", "Base HT", "TVA collectée"]]
    for rate in sorted(net_by_vat.keys()):
        vat_rows.append([f"{rate*100:.1f}%", f"CHF {net_by_vat[rate]:.2f}", f"CHF {vat_by_vat[rate]:.2f}"])
    tv = Table(vat_rows, colWidths=[5 * cm, 5.5 * cm, 5.5 * cm])
    tv.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#DDDDDD")),
    ]))
    story.append(tv)

    story.append(Paragraph("Produits vendus (par quantité)", h2))
    prods = sorted(product_qty.items(), key=lambda x: -x[1])
    prod_rows = [["Produit", "Quantité"]]
    for name, qty in prods:
        prod_rows.append([name, str(qty)])
    if len(prod_rows) == 1:
        prod_rows.append(["—", "0"])
    tp = Table(prod_rows, colWidths=[12 * cm, 4 * cm])
    tp.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#DDDDDD")),
    ]))
    story.append(tp)

    story.append(Spacer(1, 1 * cm))
    story.append(Paragraph("Document anonymisé — commandes supprimées exclues.", sub_style))

    doc.build(story)
    return buf.getvalue()
