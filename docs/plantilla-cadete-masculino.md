# Plantilla Cadete Masculino 2026/2027

La plantilla se ha importado desde `docs/Listado Cadetes Masc. Temporada 2026_2027 - Septiembre.csv`, contrastando la categoría y los nombres del PDF federativo disponible en `docs/listado_cadete_masculino_(2011-2012)_cartama.pdf`.

Se almacenan únicamente los datos solicitados para la primera versión:

- año de nacimiento, derivado de la fecha de nacimiento;
- dorsal;
- nombre y apellidos;
- fecha de nacimiento.

La clasificación operativa es ascendente por año de nacimiento. Como desempate se utiliza el dorsal y después los apellidos. La tabla `people` conserva nombre y fecha; `players` conserva dorsal y vínculo al equipo.

## Jugadores importados

| Año | Dorsal | Nombre | Fecha de nacimiento |
|---:|---:|---|---|
| 2011 | 26 | Saúl González González | 26/01/2011 |
| 2011 | 4 | José Antonio Rodríguez Enríquez | 22/02/2011 |
| 2011 | 8 | Juan Cañas Poveda | 16/03/2011 |
| 2011 | 5 | Dario García Merino | 13/04/2011 |
| 2011 | 18 | Adrián Martínez Jorge | 02/05/2011 |
| 2011 | 36 | Ulises Jiménez Carmona | 11/05/2011 |
| 2011 | 13 | David Ortega Camacho | 03/07/2011 |
| 2011 | 9 | Luis Carrasco Roldán | 16/07/2011 |
| 2011 | 11 | Eloy Rivero Troiteiro | 08/08/2011 |
| 2011 | 77 | Antonio Daniel Rosado Sánchez | 31/08/2011 |
| 2011 | 16 | Miguel Guerrero Rivas | 23/09/2011 |
| 2011 | 24 | Alejandro Navarro Hurtado | 25/11/2011 |
| 2012 | 2 | Pablo Moreno Arcas | 02/01/2012 |
| 2012 | 31 | Fabio Torres Mansukhani | 24/05/2012 |
| 2012 | 0 | José Pablo Robles Valero | 16/06/2012 |
| 2012 | 12 | Lucas Borges Rodríguez | 04/07/2012 |
| 2012 | 88 | Samir Martínez Derouach | 16/07/2012 |
| 2012 | 23 | Alejandro Moreno Rosa | 18/07/2012 |
| 2012 | 22 | Alejandro Santana Alba | 29/10/2012 |
| 2012 | 20 | Nicolas Lucena González | 17/11/2012 |

La migración `007_cadete_attendance.sql` es idempotente para los datos de jugadores y crea el equipo `Cadete Masculino` de la temporada `2026/2027`. La migración `008_cadete_current_season.sql` deja esa temporada como actual.
