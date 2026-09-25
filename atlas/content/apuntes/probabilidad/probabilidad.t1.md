# Tema 1 · Sucesos y probabilidad

Apuntes de ejemplo: muestran el formato que pinta el lector de Atlas (secciones, fórmulas, tablas y llamadas). Este tema fija el lenguaje de sucesos y las reglas básicas para calcular probabilidades.

## Espacio muestral y sucesos

El **espacio muestral** $\Omega$ es el conjunto de todos los resultados posibles de un experimento aleatorio. Un **suceso** es cualquier subconjunto de $\Omega$.

Al lanzar un dado, $\Omega=\{1,2,3,4,5,6\}$ y «sacar par» es el suceso $A=\{2,4,6\}$.

Las operaciones con sucesos son operaciones de conjuntos:

| Suceso | Notación | Ocurre cuando… |
|---|---|---|
| Unión | $A\cup B$ | ocurre $A$, $B$ o ambos |
| Intersección | $A\cap B$ | ocurren $A$ y $B$ a la vez |
| Complementario | $\overline{A}$ | no ocurre $A$ |

> **Error típico.** Llamar incompatibles a dos sucesos «que no se influyen». Incompatibles significa $A\cap B=\varnothing$: no pueden ocurrir a la vez.

## Axiomas de Kolmogórov

Una **probabilidad** es una función $P$ sobre los sucesos que cumple:

1. $P(A)\ge 0$ para todo suceso $A$.
2. $P(\Omega)=1$.
3. Si $A$ y $B$ son incompatibles, $P(A\cup B)=P(A)+P(B)$.

De ellos se deducen las reglas de uso diario:

$$P(\overline{A})=1-P(A),\qquad P(A\cup B)=P(A)+P(B)-P(A\cap B).$$

> **Idea clave.** Cuando el enunciado dice «al menos uno», casi siempre es más fácil calcular el complementario, «ninguno».

## Regla de Laplace

Si los $n$ resultados de $\Omega$ son **equiprobables**, la probabilidad de un suceso es

$$P(A)=\frac{\text{casos favorables}}{\text{casos posibles}}=\frac{|A|}{n}.$$

> **Ojo.** Solo vale con resultados equiprobables. Las sumas de dos dados ($2,\dots,12$) no lo son: el $7$ sale de seis maneras y el $2$ de una.

## Chuleta

| Regla | Fórmula |
|---|---|
| Complementario | $P(\overline{A})=1-P(A)$ |
| Unión | $P(A\cup B)=P(A)+P(B)-P(A\cap B)$ |
| Laplace | $P(A)=\lvert A\rvert/n$ |

## Ejercicios resueltos

**1.** Se extrae una carta de una baraja española de $40$ cartas. ¿Probabilidad de que sea un oro o una figura?

Hay $10$ oros y $12$ figuras, de las que $3$ son oros. Por la regla de la unión: $P=\frac{10}{40}+\frac{12}{40}-\frac{3}{40}=\frac{19}{40}$.

**2.** Se lanza una moneda tres veces. ¿Probabilidad de obtener al menos una cara?

El complementario es «tres cruces», con probabilidad $\frac{1}{8}$. Luego $P=1-\frac{1}{8}=\frac{7}{8}$.

## Antes del control

- Sé escribir el espacio muestral de un experimento y expresar un suceso como subconjunto.
- Sé distinguir sucesos incompatibles de sucesos cualesquiera.
- Sé aplicar la regla de la unión y la del complementario.
- Sé cuándo puedo usar la regla de Laplace y cuándo no.
