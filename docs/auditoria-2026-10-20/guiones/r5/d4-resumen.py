"""D4 · Resumen de d4-tiempos.jsonl: por escenario, compresión, red, procesador y pantalla, la mediana y el rango de las
repeticiones (s). También la calibración del equipo (ms de un cálculo fijo; más alto = equipo más ocupado).
    python3 d4-resumen.py → d4-tiempos.md"""
import json, statistics, collections
from pathlib import Path
EV = Path(__file__).resolve().parent
filas = [json.loads(l) for l in (EV / 'd4-tiempos.jsonl').read_text().splitlines() if l.strip()]
g = collections.defaultdict(list)
for f in filas:
    g[(f['esc'], f.get('comp', 'no'), f['red'], f['cpu'], f['pantalla'])].append(f)
s = lambda v: f"{v / 1000:.1f}"
md = ['# D4 · Tiempos (mediana de las repeticiones; entre paréntesis, mínimo–máximo de «usable»)\n',
      f'{len(filas)} cargas. Calibración del equipo: mediana {statistics.median(f["calib"] for f in filas):.0f} ms (mín. {min(f["calib"] for f in filas)}, máx. {max(f["calib"] for f in filas)}); carga media del equipo {statistics.median(float(f["cargaEquipo"]) for f in filas):.1f} con 2 procesadores (equipo compartido con otros revisores: los tiempos de procesador son una cota superior).\n',
      '| Escenario | Compresión | Red | Procesador | Pantalla | n | Primer contenido (s) | DOM listo (s) | Usable (s) | Tiempo bloqueado (ms) | Tarea más larga (ms) |',
      '|---|---|---|---|---|---|---|---|---|---|---|']
for k in sorted(g, key=lambda k: (k[0], k[1], k[2], k[3], k[4])):
    v = g[k]
    med = lambda c: statistics.median(x[c] for x in v)
    us = [x['usable'] for x in v]
    err = ' ⚠ ' + v[0]['error'][:40] if any(x.get('error') for x in v) else ''
    md.append(f"| {k[0]} | {k[1]} | {k[2]} | {k[3]}× | {k[4]} | {len(v)} | {s(med('fcp'))} | {s(med('dcl'))} | {s(med('usable'))} ({s(min(us))}–{s(max(us))}) | {med('tbt'):.0f} | {med('maxLarga'):.0f} |{err}")
(EV / 'd4-tiempos.md').write_text('\n'.join(md) + '\n', encoding='utf8')
print('\n'.join(md))

# ── Tabla compacta (sin la tanda «gzip» por cabecera, descartada: ver informe §7) ──
COLS = [('ficticios', 'no', '3g', 6), ('ficticios', 'gzs', '3g', 6), ('ficticios', 'no', '4g', 4), ('ficticios', 'gzs', '4g', 4),
        ('volumen', 'no', 'sin', 4), ('volumen', 'no', 'sin', 6), ('volumen', 'gzs', '4g', 4)]
pant = sorted({k[4] for k in g}, key=lambda p: ['index','cuenta','entrar','tramites','datos','solicitud','corregir','verificar','material','revision','revisar','citas','cotejo','grupos','espera','programar','grupo','asistencia','aplicar','examen','material-personal'].index(p))
t = ['| Pantalla | 3G lento + 6×, sin comprimir | 3G lento + 6×, gzip | 4G lento + 4×, sin comprimir | 4G lento + 4×, gzip | Volumen, sin freno de red, 4× | Volumen, sin freno, 6× | Volumen, 4G lento + 4×, gzip |', '|---|---|---|---|---|---|---|---|']
for p in pant:
    celdas = []
    for c in COLS:
        v = g.get(c + (p,))
        if not v: celdas.append('—'); continue
        us = [x['usable'] for x in v]
        celdas.append(f"{s(statistics.median(us))} ({s(min(us))}–{s(max(us))})")
    t.append(f"| {p} | " + ' | '.join(celdas) + ' |')
(EV / 'd4-tiempos-compacta.md').write_text('Usable en segundos: mediana de 2 repeticiones (mínimo–máximo). «gzip» = scripts, estilos y datos comprimidos, HTML sin comprimir (prefijo gzs).\n\n' + '\n'.join(t) + '\n', encoding='utf8')
print('\n'.join(t))
