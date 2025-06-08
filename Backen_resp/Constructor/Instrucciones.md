// CSS orden
(ninguna)	1 x 1	[1x1]
.bento-box--2x1	2 x 1	[ 2x1 ]
.bento-box--1x2	1 x 2	[ ]&lt;br>[ ]
.bento-box--2x2	2 x 2	[ ]&lt;br>[ 2x2 ]
.bento-box--3x1	3 x 1	[ 3x1 ]
.bento-box--4x1	4 x 1 (Ancho Completo)	[ 4x1 ]

// 2. Módulos del Feed (Dinámicos e Intercalados)
Estos son los módulos que se generan a partir del feed de Substack y los módulos fijos que "interrumpen" ese feed.

2.1. Patrón de Tamaño para Posts de Substack
El tamaño de estas tarjetas se controla con el algoritmo que está dentro del bucle posts.forEach. Puedes cambiar los números para crear tu propio patrón.
// En app.js, dentro del bucle posts.forEach

let sizeClass = ''; // Tamaño por defecto 1x1

if (index === 0) {
    sizeClass = 'bento-box--2x2'; // El primer post siempre es 2x2
} else if (index % 5 === 1) {
    sizeClass = 'bento-box--1x2'; // El 2do, 7mo, etc., será alto
} else if (index % 5 === 3) {
    sizeClass = 'bento-box--2x1'; // El 4to, 9no, etc., será ancho
}

// 2.2. Posición de Módulos Fijos (Intercalados)
La posición de un módulo fijo dentro del feed se controla con una condición if basada en el index.

La Regla General: Para insertar un módulo después del post número 'N', la condición es if (index === N - 1).

1er post	if (index === 0)
2do post	if (index === 1)
3er post	if (index === 2)
4to post	if (index === 3)
5º post	if (index === 4)
6to post	if (index === 5)
...y así sucesivamente.	

Exportar a Hojas de cálculo
