"""Documentos ficticios para la versión de prueba: un PDF de varias hojas por cada requisito que se carga en línea,
para probar el visor de la revisión documental (decisión 2026-10-16: ver todas las hojas al revisar).

No son documentos de nadie: cada hoja dice «DOCUMENTO FICTICIO · SIN VALIDEZ», el tipo de documento y «Hoja N de M»,
con renglones grises en lugar de datos. El número de hojas imita al documento real (la identificación, frente y
reverso; los comprobantes de experiencia, varias constancias en un solo PDF).

Uso: python3 herramientas/documentos-ficticios.py   → escribe datos/documentos/<requisito>.pdf
(construir-sitio.mjs los copia a sitio/datos/documentos/).
"""
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "datos" / "documentos"

# requisito → (nombre, hojas, qué hay en cada hoja)
DOCUMENTOS = {
    "identificacion_oficial": ("Identificación oficial", ["Frente", "Reverso"]),
    "curp": ("Clave Única de Registro de Población (CURP)", ["Constancia"]),
    "comprobante_domicilio": ("Comprobante de domicilio", ["Recibo"]),
    "constancia_situacion_fiscal": ("Constancia de situación fiscal", ["Datos de identificación", "Domicilio fiscal", "Actividades y obligaciones"]),
    "comprobante_estudios": ("Comprobante de estudios", ["Título o constancia", "Reverso con registro"]),
    "curriculum_vitae": ("Currículum vitae", ["Datos y formación", "Experiencia", "Cursos y referencias"]),
    "comprobantes_experiencia": ("Comprobantes de experiencia", ["Constancia laboral 1", "Constancia laboral 2", "Constancia laboral 3", "Contrato de servicios", "Carta de recomendación"]),
    # El acta que carga la persona para pedir la reposición de su credencial (P140, sesión de trabajo del 23/10/2026)
    "acta_reposicion": ("Acta por pérdida o robo de la credencial", ["Acta", "Hoja de firmas"]),
}

GRIS = HexColor("#55585A")
GRIS_CL = HexColor("#C9C3BF")
FONDO = HexColor("#F4F5F6")
MARCA = HexColor("#E2DEDB")


def hoja(c, nombre, parte, n, total, horizontal):
    ancho, alto = c._pagesize
    c.setFillColor(FONDO)
    c.rect(0, alto - 90, ancho, 90, stroke=0, fill=1)
    c.setFillColor(GRIS)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, alto - 32, "DOCUMENTO FICTICIO · SIN VALIDEZ · VERSIÓN DE PRUEBA")
    c.setFont("Helvetica-Bold", 18)
    c.drawString(40, alto - 60, nombre)
    c.setFont("Helvetica", 12)
    c.drawString(40, alto - 80, parte)
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(ancho - 40, alto - 60, f"Hoja {n} de {total}")
    # Marca de agua diagonal
    c.saveState()
    c.translate(ancho / 2, alto / 2)
    c.rotate(35)
    c.setFillColor(MARCA)
    c.setFont("Helvetica-Bold", 64 if not horizontal else 52)
    c.drawCentredString(0, 0, "FICTICIO")
    c.restoreState()
    # Renglones grises en lugar de datos
    c.setFillColor(GRIS_CL)
    y = alto - 140
    i = 0
    while y > 80:
        largo = (ancho - 80) * (0.55 + 0.4 * ((i * 37 + n * 11) % 10) / 10)
        c.rect(40, y, largo, 8, stroke=0, fill=1)
        y -= 26 if i % 5 != 4 else 44
        i += 1
    c.setFillColor(GRIS)
    c.setFont("Helvetica", 9)
    c.drawString(40, 40, "Generado por herramientas/documentos-ficticios.py para probar el visor. No contiene datos de ninguna persona.")


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    for clave, (nombre, partes) in DOCUMENTOS.items():
        ruta = SALIDA / f"{clave}.pdf"
        # La identificación va apaisada, como una credencial escaneada
        horizontal = clave == "identificacion_oficial"
        tam = (letter[1], letter[0]) if horizontal else letter
        c = canvas.Canvas(str(ruta), pagesize=tam, invariant=1)
        c.setTitle(f"{nombre} (ficticio)")
        c.setAuthor("Versión de prueba · datos ficticios")
        for n, parte in enumerate(partes, 1):
            hoja(c, nombre, parte, n, len(partes), horizontal)
            c.showPage()
        c.save()
        print(f"{ruta.relative_to(RAIZ)} · {len(partes)} hoja(s)")


if __name__ == "__main__":
    main()
