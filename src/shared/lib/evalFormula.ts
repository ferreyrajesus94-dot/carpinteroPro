/**
 * Evaluador seguro de expresiones aritméticas para fórmulas de cantidad.
 * Soporta: números decimales, + - * /, paréntesis, menos unario y variables.
 * Las variables deben empezar con letra o _ y contener sólo letras, dígitos o _.
 *
 * NO usa eval() ni Function(). Implementa un parser recursivo clásico.
 *
 *   eval = term (('+'|'-') term)*
 *   term = factor (('*'|'/') factor)*
 *   factor = number | identifier | '(' eval ')' | '-' factor
 */

type Token =
	| { type: "num"; value: number }
	| { type: "ident"; value: string }
	| { type: "op"; value: "+" | "-" | "*" | "/" | "(" | ")" };

function tokenize(input: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	while (i < input.length) {
		const c = input[i];
		if (c === " " || c === "\t" || c === "\n") {
			i++;
			continue;
		}
		if (
			c === "+" ||
			c === "-" ||
			c === "*" ||
			c === "/" ||
			c === "(" ||
			c === ")"
		) {
			tokens.push({ type: "op", value: c });
			i++;
			continue;
		}
		if ((c >= "0" && c <= "9") || c === ".") {
			let j = i;
			let sawDot = false;
			while (j < input.length) {
				const cj = input[j];
				if (cj >= "0" && cj <= "9") {
					j++;
					continue;
				}
				if (cj === "." && !sawDot) {
					sawDot = true;
					j++;
					continue;
				}
				break;
			}
			const n = Number(input.slice(i, j));
			if (!Number.isFinite(n))
				throw new Error(`Número inválido: ${input.slice(i, j)}`);
			tokens.push({ type: "num", value: n });
			i = j;
			continue;
		}
		if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_") {
			let j = i + 1;
			while (j < input.length) {
				const cj = input[j];
				if (
					(cj >= "a" && cj <= "z") ||
					(cj >= "A" && cj <= "Z") ||
					(cj >= "0" && cj <= "9") ||
					cj === "_"
				) {
					j++;
					continue;
				}
				break;
			}
			tokens.push({ type: "ident", value: input.slice(i, j) });
			i = j;
			continue;
		}
		throw new Error(`Carácter inválido en fórmula: "${c}"`);
	}
	return tokens;
}

export function evalFormula(
	expr: string,
	vars: Record<string, number>,
): number {
	const tokens = tokenize(expr);
	let pos = 0;

	function peek(): Token | undefined {
		return tokens[pos];
	}
	function consume(): Token | undefined {
		return tokens[pos++];
	}

	function parseFactor(): number {
		const t = peek();
		if (!t) throw new Error("Fórmula incompleta");
		if (t.type === "op" && t.value === "-") {
			consume();
			return -parseFactor();
		}
		if (t.type === "op" && t.value === "+") {
			consume();
			return parseFactor();
		}
		if (t.type === "op" && t.value === "(") {
			consume();
			const v = parseExpr();
			const close = consume();
			if (!close || close.type !== "op" || close.value !== ")")
				throw new Error('Falta ")"');
			return v;
		}
		if (t.type === "num") {
			consume();
			return t.value;
		}
		if (t.type === "ident") {
			consume();
			if (!(t.value in vars))
				throw new Error(`Variable desconocida: ${t.value}`);
			return vars[t.value];
		}
		throw new Error(`Token inesperado: ${String(t.value)}`);
	}

	function parseTerm(): number {
		let v = parseFactor();
		while (true) {
			const t = peek();
			if (!t || t.type !== "op") break;
			if (t.value !== "*" && t.value !== "/") break;
			consume();
			const r = parseFactor();
			if (t.value === "*") v = v * r;
			else {
				if (r === 0) throw new Error("División por cero");
				v = v / r;
			}
		}
		return v;
	}

	function parseExpr(): number {
		let v = parseTerm();
		while (true) {
			const t = peek();
			if (!t || t.type !== "op") break;
			if (t.value !== "+" && t.value !== "-") break;
			consume();
			const r = parseTerm();
			v = t.value === "+" ? v + r : v - r;
		}
		return v;
	}

	const result = parseExpr();
	if (pos !== tokens.length) throw new Error("Fórmula mal formada");
	if (!Number.isFinite(result)) throw new Error("Resultado no finito");
	return result;
}

/** Devuelve el valor evaluado o el fallback si la fórmula falla o está vacía. */
export function safeEvalFormula(
	formula: string | null | undefined,
	vars: Record<string, number>,
	fallback: number,
): number {
	if (!formula || !formula.trim()) return fallback;
	try {
		return evalFormula(formula, vars);
	} catch {
		return fallback;
	}
}
