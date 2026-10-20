"""C5 · Formas de escribir fechas y horas, por pantalla (visibles y bloques ocultos), con un ejemplo de cada una.
Lee c5-pantallas.json y c5-acuses.json. Escribe c5-fechas.md.   python3 c5-fechas.py"""
import json, re, collections
from pathlib import Path
EV = Path(__file__).resolve().parent
P = json.loads((EV / 'c5-pantallas.json').read_text(encoding='utf8'))
A = json.loads((EV / 'c5-acuses.json').read_text(encoding='utf8'))
M = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre'
D = 'lunes|martes|miércoles|jueves|viernes|sábado|domingo'
FORMAS = [  # el orden importa: la primera que coincide se queda con el trozo
    ('K «d de mes de aaaa, HH:MM» (acuse del estándar)', rf'\b\d{{1,2}} de ({M}) de \d{{4}}, \d{{2}}:\d{{2}}\b'),
    ('J «dd/mm/aaaa, a las HH:MM»', r'\b\d{2}/\d{2}/\d{4}, a las \d{2}:\d{2}\b'),
    ('I «dd/mm/aaaa a las HH:MM»', r'\b\d{2}/\d{2}/\d{4} a las \d{1,2}:\d{2}\b'),
    ('H «dd/mm/aaaa, HH:MM»', r'\b\d{2}/\d{2}/\d{4}, \d{2}:\d{2}\b'),
    ('G «del dd/mm/aaaa al dd/mm/aaaa»', r'\b[Dd]el \d{2}/\d{2}/\d{4} al \d{2}/\d{2}/\d{4}\b'),
    ('F «del d al d de mes» (nombre del grupo, decisión 18/10)', rf'\b[Dd]el \d{{1,2}}( de ({M}))? al \d{{1,2}} de ({M})( de \d{{4}})?'),
    ('F2 «d al d de mes» (semanas del planeador)', rf'(?<!del )\b\d{{1,2}}( de ({M}))? al \d{{1,2}} de ({M})\b'),
    ('E1 «Día d de mes [al día d de mes]» (programar)', rf'\b({D}) \d{{1,2}} de ({M})\b'),
    ('E2 «día dd/mm/aaaa»', rf'\b({D}),? \d{{2}}/\d{{2}}/\d{{4}}\b'),
    ('E3 «día dd/mm» (sin año)', rf'\b({D}) \d{{2}}/\d{{2}}\b(?!/)'),
    ('E4 «Día, d de mes de aaaa» (agenda)', rf'\b({D}), \d{{1,2}} de ({M}) de \d{{4}}\b'),
    ('D «d de mes de aaaa»', rf'\b\d{{1,2}} de ({M}) de \d{{4}}\b'),
    ('C «d de mes» (sin año)', rf'\b\d{{1,2}} de ({M})\b'),
    ('B «dd/mm» (sin año)', r'(?<![/\d])\d{2}/\d{2}(?![/\d])'),
    ('A «dd/mm/aaaa»', r'\b\d{2}/\d{2}/\d{4}\b'),
]
FORMAS = [(n, re.compile(rx, re.I)) for n, rx in FORMAS]
por = collections.defaultdict(lambda: collections.defaultdict(list))
def mide(pant, t):
    resto = t
    for n, rx in FORMAS:
        for m in rx.finditer(resto):
            por[pant][n].append(t)
        resto = rx.sub('§', resto)
for e in P['estados']:
    for cl in ('visibles', 'ocultos'):
        for t in e[cl]:
            if len(t) > 400: continue  # textos concatenados de tablas
            mide(e['pantalla'], t)
for a in A[:1]:
    for t in (a['acuseCuenta'] + '\n' + a['acuseSol']).split('\n'): mide('acuse (cuenta y solicitud)', t)
md = ['# C5 · Formas de fecha y hora por pantalla\n', 'Cuenta de renglones distintos (visibles y ocultos) por forma; un ejemplo de cada una. «A dd/mm/aaaa» es la del sistema.\n',
      '| Pantalla | Formas distintas | Forma: renglones (ejemplo) |', '|---|---|---|']
for pant in sorted(por):
    formas = por[pant]
    det = '<br>'.join(f"{n}: {len(set(v))} («{sorted(set(v), key=len)[0][:90]}»)" for n, v in sorted(formas.items()))
    md.append(f'| {pant} | {len(formas)} | {det} |')
tot = collections.Counter()
for pant in por:
    for n in por[pant]: tot[n] += 1
md.append('\n**Pantallas en que aparece cada forma:** ' + ' · '.join(f'{n}: {k}' for n, k in sorted(tot.items())))
(EV / 'c5-fechas.md').write_text('\n'.join(md) + '\n', encoding='utf8')
print('\n'.join(md))
