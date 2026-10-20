"""C5 · Análisis de textos (auditoría 20/10/2026, r5). Lee c5-pantallas.json (lo que se ve, con scripts) y
c5-fuentes.json (cadenas del código, del estándar, de la base y de los avisos por correo) y aplica detectores:
trato (tú/usted), nombres internos, formatos de fecha y hora, números y montos, vocabulario por concepto,
tecnicismos, ortografía y acentos, puntuación y tono. Escribe c5-detectores.json y c5-detectores.md.
Los detectores marcan candidatos: cada uno se revisa a mano antes de reportarlo (ver informe.md).
    python3 c5-analisis.py
"""
import json, re, collections
from pathlib import Path

EV = Path(__file__).resolve().parent
P = json.loads((EV / 'c5-pantallas.json').read_text(encoding='utf8'))
F = json.loads((EV / 'c5-fuentes.json').read_text(encoding='utf8'))

# ── Unidades de texto ──
unidades = []  # {tipo, donde, publico, contexto, texto}
porPant = collections.defaultdict(lambda: collections.defaultdict(set))
for e in P['estados']:
    for clase in ('visibles', 'ocultos', 'atributos'):
        for t in e[clase]:
            porPant[(e['pantalla'], e['publico'], clase)][t].add(e['estado'])
for (pant, pub, clase), d in porPant.items():
    for t, est in d.items():
        unidades.append({'tipo': 'pantalla', 'donde': pant, 'publico': pub, 'clase': clase, 'contexto': sorted(est)[:3] + ([f'… y {len(est) - 3} más'] if len(est) > 3 else []), 'texto': t})
for f in F:
    unidades.append({'tipo': f['origen'], 'donde': f"{f['archivo']}:{f['linea']}", 'publico': f['publico'], 'clase': f.get('codigo', ''), 'contexto': [], 'texto': f['texto']})

# ── Detectores ──
W = lambda s: re.compile(r'(?<![\wáéíóúñü])(' + s + r')(?![\wáéíóúñü])', re.I)
IMP_TU = 'revisa|carga|escribe|elige|selecciona|verifica|intenta|asegúrate|acude|lleva|consulta|corrige|vuelve|ingresa|entra|crea|inicia|guarda|envía|espera|confirma|adjunta|marca|completa|usa|toma|descarga|imprime|renueva|recoge|paga|levanta|contesta|lee|sigue|cambia|prueba|pide|agrega|quita|abre|busca|regresa|llena|toca|pulsa|haz|pon|ten|sal|di|ven|recuerda|anota|indica|comprueba|presenta|preséntate|acércate|fíjate|comunícate|dirígete|cuida|evita|procura|elimina|conserva|solicita|actualiza|sube|activa|identifícate|avisa'
IMP_UD = 'revise|cargue|escriba|elija|seleccione|verifique|intente|asegúrese|acuda|lleve|consulte|corrija|vuelva|ingrese|cree|inicie|guarde|envíe|espere|confirme|adjunte|marque|complete|use|tome|descargue|imprima|renueve|recoja|pague|levante|conteste|lea|siga|cambie|pruebe|pida|agregue|quite|abra|busque|regrese|llene|toque|pulse|haga|ponga|vaya|tenga|salga|diga|venga|recuerde|anote|indique|compruebe|preséntese|acérquese|fíjese|comuníquese|diríjase|cuide|evite|procure|elimine|conserve|solicite|actualice|suba|active|identifíquese|avise|capture|registre|asigne|valide|observe|rechace|retome|termine|explique|deje|cancele|programe|pase|dé'
TU = W(r'tú|tu|tus|ti|contigo|te|tuy[oa]s?|puedes|tienes|debes|quieres|necesitas|estás|eres|has|vas|ves|sabes|haces|recibes|cargaste|enviaste|declaraste|pagaste|elegiste|hiciste|llegaste|subiste|escribiste|tengas|puedas|quieras|estés|\w+rás|\w+ste|\w+aste|\w+iste')
UD = W(r'usted(?:es)?|' + r'|'.join(['asegúrese', 'preséntese', 'acérquese', 'fíjese', 'comuníquese', 'diríjase', 'identifíquese']))
INI_TU = re.compile(r'(?:^|[.:;!?¿¡]\s+|«|\(|—\s)(' + IMP_TU + r')(?![\wáéíóúñ])', re.I)
INI_UD = re.compile(r'(?:^|[.:;!?¿¡]\s+|«|\(|—\s)(' + IMP_UD + r')(?![\wáéíóúñ])', re.I)
FALSO_TU = re.compile(r'\b(\w+rás)\b', re.I)
def trato(t):
    tu = [m.group(1) for m in TU.finditer(t)] + [m.group(1) for m in INI_TU.finditer(t)]
    # -rás / -ste: descarta palabras que no son verbos (atrás, demás, más, este, …)
    tu = [x for x in tu if x.lower() not in ('atrás', 'detrás', 'demás', 'jamás', 'más', 'este', 'oeste', 'ajuste', 'existe', 'triste', 'consiste', 'resiste', 'insiste', 'asiste', 'viste', 'chiste', 'despiste', 'quiste', 'contraste', 'desgaste', 'hasta', 'baste', 'gaste', 'caste', 'traste', 'arraste', 'ajustes', 'ves')]
    ud = [m.group(1) for m in UD.finditer(t)] + [m.group(1) for m in INI_UD.finditer(t)]
    return tu, ud

MESES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre'
FECHAS = [
    ('dd/mm/aaaa', re.compile(r'\b\d{1,2}/\d{1,2}/\d{4}\b')),
    ('dd/mm/aa', re.compile(r'\b\d{1,2}/\d{1,2}/\d{2}\b(?!/)')),
    ('AAAA-MM-DD (ISO)', re.compile(r'\b\d{4}-\d{2}-\d{2}\b')),
    ('d de mes de aaaa', re.compile(r'\b\d{1,2} de (' + MESES + r') de \d{4}\b', re.I)),
    ('d de mes (sin año)', re.compile(r'\b\d{1,2} de (' + MESES + r')\b(?! de \d{4})', re.I)),
    ('día de la semana', re.compile(r'\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b', re.I)),
    ('mes abreviado', re.compile(r'\b\d{1,2}[ -](ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic)\.?(?![a-záéíóú])', re.I)),
    ('mes de aaaa', re.compile(r'\b(' + MESES + r') (de )?\d{4}\b', re.I)),
]
HORAS = [
    ('HH:MM', re.compile(r'\b\d{1,2}:\d{2}\b(?!\s*(a\.?\s?m|p\.?\s?m|h\b|hrs?\b))', re.I)),
    ('a. m. / p. m.', re.compile(r'\b\d{1,2}(:\d{2})?\s*(a\.?\s?m\.?|p\.?\s?m\.?)(?![a-z])', re.I)),
    ('HH:MM h / hrs', re.compile(r'\b\d{1,2}:\d{2}\s*(h|hrs?|horas)\b', re.I)),
]
NUM = [
    ('$ con decimales', re.compile(r'\$\s?\d{1,3}(,\d{3})*\.\d{2}\b')),
    ('$ sin decimales', re.compile(r'\$\s?\d{1,3}(,\d{3})*(?![.\d])')),
    ('$ sin separador de miles', re.compile(r'\$\s?\d{4,}')),
    ('$ con espacio', re.compile(r'\$\s\d')),
    ('pesos / MXN', re.compile(r'\b(pesos|MXN|M\.N\.)\b')),
    ('número ≥ 1000 sin separador', re.compile(r'(?<![\w/.:-])\d{4,}(?![\w/.:-])')),
    ('decimal con coma', re.compile(r'\b\d+,\d{1,2}\b(?!\d)')),
    ('MB/KB pegado', re.compile(r'\d(MB|KB|GB)\b')),
    ('MB/KB con espacio', re.compile(r'\d (MB|KB|GB)\b')),
    ('porcentaje', re.compile(r'\d\s?%')),
]
INTERNOS = [
    ('snake_case', re.compile(r'(?<![\w.@/-])[a-z]+(_[a-z0-9]+)+(?![\w@.-])')),
    ('camelCase', re.compile(r'(?<![\w.@/-])[a-z]+[A-Z][a-zA-Z]+(?![\w@.-])')),
    ('null/undefined/NaN', re.compile(r'\b(null|undefined|NaN|Infinity|\[object \w+\]|true|false)\b')),
    ('marcador sin reemplazar', re.compile(r'\{[a-zA-Z]+\}|%s|\$\{')),
    ('código apd', re.compile(r'\bapd[:.][a-z_]+')),
    ('entidad HTML', re.compile(r'&(amp|lt|gt|quot|nbsp);')),
]
VOCAB = collections.OrderedDict([
    ('folio de la solicitud', [r'folio de (?:la|tu|su) solicitud', r'n[úu]mero de (?:la |tu |su )?solicitud', r'n[úu]mero de folio', r'clave de (?:la )?solicitud', r'folio(?! de (?:la|tu|su) solicitud| del grupo| de grupo| fiscal)']),
    ('número de expediente', [r'n[úu]mero de expediente', r'folio del expediente', r'clave del expediente', r'n[úu]m\. de expediente', r'expediente f[íi]sico', r'expediente']),
    ('número de acreditación', [r'n[úu]mero de (?:la |tu |su )?acreditaci[óo]n', r'folio de (?:la )?acreditaci[óo]n', r'n[úu]mero de (?:la |tu |su )?credencial', r'n[úu]mero de registro']),
    ('cuota / pago de derechos (P144)', [r'pago de derechos', r'derechos', r'cuota', r'costo', r'monto', r'tarifa', r'precio', r'pago(?! de derechos)']),
    ('cita de cotejo', [r'cita de cotejo', r'cotejo documental', r'cotejo presencial', r'cita presencial', r'revisi[óo]n presencial', r'cita(?! de cotejo)', r'cotejo(?! documental| presencial)']),
    ('revisión documental', [r'revisi[óo]n documental', r'revisi[óo]n en l[íi]nea', r'revisi[óo]n de (?:los |tus |sus )?documentos', r'validaci[óo]n documental']),
    ('curso', [r'curso', r'capacitaci[óo]n', r'clases?', r'taller']),
    ('evaluación o examen', [r'examen', r'evaluaci[óo]n', r'prueba(?! de)']),
    ('grupo', [r'grupo', r'generaci[óo]n', r'turno']),
    ('persona solicitante', [r'persona solicitante', r'solicitantes?', r'interesad[oa]s?', r'usuari[oa]s?', r'aspirantes?', r'participantes?', r'alumn[oa]s?', r'ciudadan[oa]s?']),
    ('la Secretaría', [r'Secretar[íi]a del Medio Ambiente', r'Secretar[íi]a', r'SEDEMA', r'la Direcci[óo]n']),
    ('sede', [r'Vivero Nezahualc[óo]yotl', r'Vivero Netzahualc[óo]yotl', r'Vivero', r'PILARES', r'sede']),
    ('comprobante de pago', [r'comprobante de pago', r'recibo(?: de pago)?', r'ficha de pago', r'l[íi]nea de captura', r'referencia(?: bancaria| de pago)?', r'voucher']),
    ('constancia de situación fiscal', [r'constancia de situaci[óo]n fiscal', r'constancia fiscal', r'\bCSF\b', r'c[ée]dula fiscal']),
    ('observaciones', [r'observaci[óo]n(?:es)?', r'correcci[óo]n(?:es)?', r'comentarios?']),
    ('dictaminador técnico', [r'dictaminador t[ée]cnico', r'dictaminadora', r'dictaminador(?! t[ée]cnico)', r'dictaminaci[óo]n']),
    ('poda y derribo', [r'poda y derribo', r'podador(?:a|es)?', r'poda(?! y derribo)']),
    ('entrar / salir', [r'iniciar sesi[óo]n', r'ingresar', r'entrar', r'cerrar sesi[óo]n', r'salir']),
    ('correo electrónico', [r'correo electr[óo]nico', r'e-?mail', r'correo(?! electr[óo]nico)']),
    ('contraseña', [r'contrase[ñn]a', r'clave de acceso', r'password']),
    ('fotografía', [r'fotograf[íi]a', r'foto(?!graf)']),
    ('instructor', [r'instructora?', r'capacitador(?:a)?', r'facilitador(?:a)?', r'docente']),
    ('calificación', [r'calificaci[óo]n', r'puntaje', r'puntuaci[óo]n', r'nota']),
    ('Mis trámites / Mi perfil', [r'Mis tr[áa]mites', r'Mis solicitudes', r'Mi perfil', r'Mis datos']),
    ('renovación', [r'renovaci[óo]n', r'refrendo', r'reacreditaci[óo]n']),
    ('acreditación / credencial', [r'acreditaci[óo]n', r'credencial', r'certificado', r'constancia de acreditaci[óo]n']),
    ('baja / cancelar', [r'dar de baja', r'baja', r'cancelar', r'cancelad[oa]', r'eliminar', r'quitar']),
])
VOCAB = {k: [(v, re.compile(r'(?<![\wáéíóúñ])' + v + r'(?![\wáéíóúñ])', re.I | re.U)) for v in vs] for k, vs in VOCAB.items()}
TECNICOS = W(r'API|servidor|base de datos|la base|bitácora|parámetro|payload|JSON|localStorage|IndexedDB|token|UUID|EXIF|metadatos|HTTP|URL|caché|script|backend|front ?end|almacenamiento|registro dañado|código de error|null|id|ID')
ACENTOS = ['asi', 'aqui', 'alli', 'ahi', 'ademas', 'tambien', 'despues', 'numero', 'numeros', 'pagina', 'paginas', 'telefono', 'electronico', 'informacion', 'revision', 'revisiones', 'acreditacion', 'acreditaciones', 'fotografia', 'dia', 'dias', 'minimo', 'maximo', 'ultimo', 'ultima', 'proximo', 'proxima', 'valido', 'valida', 'invalido', 'publico', 'publica', 'tecnico', 'tecnica', 'codigo', 'titulo', 'linea', 'sesion', 'opcion', 'opciones', 'accion', 'direccion', 'atencion', 'ubicacion', 'aplicacion', 'version', 'razon', 'segun', 'aun', 'exito', 'arbol', 'arboles', 'Mexico', 'Secretaria', 'Nezahualcoyotl', 'Coyoacan', 'Cuauhtemoc', 'Juarez', 'Alvaro', 'Obregon', 'Tlahuac', 'cotejos', 'evaluacion', 'capacitacion', 'calificacion', 'renovacion', 'observacion', 'correccion', 'adscripcion', 'tramite', 'tramites', 'periodo', 'medico', 'facil', 'dificil', 'credito', 'cedula', 'region', 'organizacion', 'institucion', 'situacion', 'constancia', 'contrasena', 'categoria', 'via', 'proposito', 'vehiculo', 'unico', 'unica', 'basico', 'practica', 'practico', 'teorica', 'teorico', 'quiza', 'quizas', 'tambien', 'mas', 'ningun', 'algun', 'comun', 'jardin', 'tecnicamente', 'electronica', 'academico', 'academica', 'licenciatura', 'pasante', 'maestria', 'Maestria', 'Licenciatura']
ACENTOS = [a for a in ACENTOS if a not in ('constancia', 'licenciatura', 'Licenciatura', 'pasante', 'mas')]
ACENT = re.compile(r'(?<![\wáéíóúñ@/._-])(' + '|'.join(ACENTOS) + r')(?![\wáéíóúñ@/._-])')
SOLO = (re.compile(r'\bsólo\b', re.I), re.compile(r'\bsolo\b', re.I))
PUNTU = [
    ('espacio antes de signo', re.compile(r'\w \s*[,.;:](?!\d)(?!\.\.)')),
    ('? sin ¿', re.compile(r'^[^¿]*\?')),
    ('! sin ¡', re.compile(r'^[^¡]*!')),
    ('comillas inglesas', re.compile(r'"[^"]{2,}"|“|”')),
    ('tres puntos', re.compile(r'\.\.\.')),
    ('dos puntos y mayúscula', re.compile(r':\s[A-ZÁÉÍÓÚ][a-záéíóú]+\s[a-záéíóú]')),
]
TONO = [
    ('«Error» / «inválido» / «incorrecto»', re.compile(r'\b(error(?:es)?|inv[áa]lid[oa]s?|incorrect[oa]s?|no v[áa]lid[oa]|fall[óo]|fatal)\b', re.I)),
    ('exclamación', re.compile(r'[!¡]')),
    ('MAYÚSCULAS', re.compile(r'\b(?!(?:CURP|RFC|PDF|SEDEMA|PILARES|SIA|NADF|JPG|PNG|MB|KB|GB|IVA|UMA|UCDMX|CDMX|CFDI|QR|XXXX|RNAT|PD|DT|APD|EXP|UNAM|DAP|ANP|II|III|IV|VI|VII|VIII|IX|XI|XII|LAU|UTC|AAAA|MM|DD|HH|SAT|ID|DGs?|OK|SI|NO|FICTICIO|EJEMPLO|MUESTRA|PRUEBA)\b)[A-ZÁÉÍÓÚÑ]{4,}\b')),
    ('«debe» / «es obligatorio»', re.compile(r'\b(debe(?:s|n)?|deber[áa]s?|es obligatori[oa]|favor de|no se permite)\b', re.I)),
]

res = collections.defaultdict(list)
for u in unidades:
    t = u['texto']
    tu, ud = trato(t)
    if tu: res['trato:tú'].append({**u, 'marcas': tu})
    if ud: res['trato:usted'].append({**u, 'marcas': ud})
    for n, rx in FECHAS + HORAS:
        m = [x.group(0) for x in rx.finditer(t)]
        if m: res[f'fecha:{n}'].append({**u, 'marcas': m})
    for n, rx in NUM:
        m = [x.group(0) for x in rx.finditer(t)]
        if m: res[f'número:{n}'].append({**u, 'marcas': m})
    for n, rx in INTERNOS:
        m = [x.group(0) for x in rx.finditer(t)]
        if m: res[f'interno:{n}'].append({**u, 'marcas': m})
    for c, vs in VOCAB.items():
        for v, rx in vs:
            m = [x.group(0) for x in rx.finditer(t)]
            if m: res[f'vocab:{c}::{v}'].append({**u, 'marcas': m})
    m = [x.group(0) for x in TECNICOS.finditer(t)]
    if m: res['tecnicismo'].append({**u, 'marcas': m})
    m = [x.group(0) for x in ACENT.finditer(t)]
    if m: res['acento: palabra sin tilde'].append({**u, 'marcas': m})
    if SOLO[0].search(t): res['acento: «sólo» con tilde'].append({**u, 'marcas': ['sólo']})
    if SOLO[1].search(t): res['acento: «solo» sin tilde'].append({**u, 'marcas': ['solo']})
    for n, rx in PUNTU + TONO:
        m = [x.group(0) for x in rx.finditer(t)]
        if m: res[f'{"tono" if (n, rx) in TONO else "puntuación"}:{n}'].append({**u, 'marcas': m})

json.dump(res, open(EV / 'c5-detectores.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
# Resumen
md = ['# C5 · Candidatos de los detectores (revisar a mano)\n', f"Unidades de texto: {len(unidades)} ({sum(1 for u in unidades if u['tipo']=='pantalla')} renglones distintos por pantalla, {sum(1 for u in unidades if u['tipo']!='pantalla')} cadenas de código, estándar, base y correos). Estados recorridos: {len(P['estados'])}.\n"]
md.append('| Detector | Candidatos | En pantallas del personal | En pantallas de la persona | En código |\n|---|---|---|---|---|')
for k in sorted(res):
    v = res[k]
    md.append(f"| {k} | {len(v)} | {sum(1 for x in v if x['tipo']=='pantalla' and x['publico']=='personal')} | {sum(1 for x in v if x['tipo']=='pantalla' and x['publico']!='personal')} | {sum(1 for x in v if x['tipo']!='pantalla')} |")
(EV / 'c5-detectores.md').write_text('\n'.join(md) + '\n', encoding='utf8')
print('\n'.join(md))

# ── Tabla de trato por pantalla (los candidatos se revisan a mano; ver informe.md) ──
pant = collections.defaultdict(lambda: {'pub': '', 'lin': set(), 'tu': set(), 'ud': set(), 'est': 0})
for e in P['estados']:
    d = pant[e['pantalla']]; d['pub'] = e['publico']; d['est'] += 1
    for cl in ('visibles', 'ocultos', 'atributos'):
        for t in e[cl]:
            d['lin'].add(t); tu, ud = trato(t)
            if tu: d['tu'].add(t)
            if ud: d['ud'].add(t)
tt = ['| Pantalla | Público (trato esperado) | Estados | Renglones distintos | Con marca de tú | Con marca de usted |', '|---|---|---|---|---|---|']
for k, d in sorted(pant.items(), key=lambda x: (x[1]['pub'], x[0])):
    esp = 'usted' if d['pub'] == 'personal' else 'tú'
    tt.append(f"| {k} | {d['pub']} ({esp}) | {d['est']} | {len(d['lin'])} | {len(d['tu'])} | {len(d['ud'])} |")
(EV / 'c5-trato.md').write_text('\n'.join(tt) + '\n', encoding='utf8')
print('\n'.join(tt))
