import * as math from 'mathjs';

// Superscript mapping for exponents
const superscripts: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'x': 'ˣ', 'y': 'ʸ', 'a': 'ᵃ', 'b': 'ᵇ',
  'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'i': 'ⁱ', 'k': 'ᵏ',
  'm': 'ᵐ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ',
  'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'z': 'ᶻ'
};

const subscripts: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'i': 'ᵢ', 'o': 'ₒ', 'r': 'ᵣ',
  'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ', 'h': 'ₕ', 'k': 'ₖ',
  'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'p': 'ₚ', 's': 'ₛ', 't': 'ₜ'
};

/**
 * Traverses a Math.js Node tree and formats it into clean, readable Unicode math text.
 */
function formatNodeToUnicode(node: any): string {
  if (!node) return '';

  switch (node.type) {
    case 'ConstantNode':
      return String(node.value);

    case 'SymbolNode':
      if (node.name === 'Delta') return 'Δ';
      if (node.name === 'pi') return 'π';
      if (node.name === 'theta') return 'θ';
      return node.name;

    case 'ParenthesisNode':
      return `(${formatNodeToUnicode(node.content)})`;

    case 'FunctionNode':
      const argsStr = node.args.map((arg: any) => formatNodeToUnicode(arg)).join(', ');
      if (node.name === 'sqrt') {
        return `√(${argsStr})`;
      }
      return `${node.name}(${argsStr})`;

    case 'OperatorNode':
      const formattedArgs = node.args.map((arg: any) => formatNodeToUnicode(arg));
      
      if (node.op === '^') {
        const base = formattedArgs[0];
        const exponent = formattedArgs[1];
        const superscriptExp = exponent
          .split('')
          .map((char: string) => superscripts[char] || char)
          .join('');
        return `${base}${superscriptExp}`;
      }

      if (node.op === '*') {
        const left = node.args[0];
        const right = node.args[1];
        const leftStr = formattedArgs[0];
        const rightStr = formattedArgs[1];
        
        // Omit multiplication sign for algebraic terms (e.g., 4 * x -> 4x)
        if (left.type === 'ConstantNode' && right.type === 'SymbolNode') {
          return `${leftStr}${rightStr}`;
        }
        return `${leftStr}·${rightStr}`;
      }

      if (node.op === '/') {
        return `${formattedArgs[0]}/${formattedArgs[1]}`;
      }

      if (node.args.length === 2) {
        return `${formattedArgs[0]} ${node.op} ${formattedArgs[1]}`;
      }

      if (node.args.length === 1) {
        return `${node.op}${formattedArgs[0]}`;
      }

      return formattedArgs.join(` ${node.op} `);

    case 'AssignmentNode':
      return `${node.name} = ${formatNodeToUnicode(node.value)}`;

    default:
      return node.toString();
  }
}

/**
 * Parse an isolated algebraic formula string (like "x^2", "y = x^2 - 4x + 3") using Math.js
 * and formats it with superscripts, Greek letters, and standard math spacing.
 */
export function formatMathExpression(expr: string): string {
  const trimmed = expr.trim();
  if (!trimmed) return '';
  
  // Clean LaTeX characters if any
  let cleanExpr = trimmed;
  if (cleanExpr.startsWith('$') && cleanExpr.endsWith('$')) {
    cleanExpr = cleanExpr.slice(1, -1).trim();
  }
  
  try {
    // If it contains an equation but math.js might fail to parse assignment, handle both sides
    if (cleanExpr.includes('=') && !cleanExpr.includes('==')) {
      const parts = cleanExpr.split('=');
      const formattedParts = parts.map(part => {
        try {
          const node = math.parse(part.trim());
          return formatNodeToUnicode(node);
        } catch {
          return part.trim();
        }
      });
      return formattedParts.join(' = ');
    }

    const node = math.parse(cleanExpr);
    return formatNodeToUnicode(node);
  } catch (e) {
    // Fallback using regex replacements if mathjs parsing fails
    let result = cleanExpr;
    result = formatExponents(result);
    result = formatSubscripts(result);
    
    // Symbol conversions
    result = result.replace(/Delta/gi, 'Δ')
                   .replace(/\\Delta/g, 'Δ')
                   .replace(/\bpi\b/gi, 'π')
                   .replace(/\\pi/g, 'π')
                   .replace(/\btheta\b/gi, 'θ')
                   .replace(/\\theta/g, 'θ')
                   .replace(/\\neq/g, '≠')
                   .replace(/\\times/g, '×')
                   .replace(/\\le/g, '≤')
                   .replace(/\\ge/g, '≥')
                   .replace(/sqrt\(([^)]+)\)/g, '√($1)');
    return result;
  }
}

/**
 * Parses any text paragraph containing natural language mixed with mathematical formulas,
 * converting math notation (like x^2, x_1, etc.) into clean unicode formats.
 */
export function formatTextWithMath(text: string): string {
  if (!text) return '';

  // Clean the text by applying exponent and subscript replacements
  let result = text;
  
  result = formatExponents(result);
  result = formatSubscripts(result);
  
  // Standard symbol translations
  result = result.replace(/\\Delta/g, 'Δ')
                 .replace(/\bDelta\b/g, 'Δ')
                 .replace(/\\pi/g, 'π')
                 .replace(/\bpi\b/g, 'π')
                 .replace(/\\theta/g, 'θ')
                 .replace(/\btheta\b/g, 'θ')
                 .replace(/\\neq/g, '≠')
                 .replace(/\\times/g, '×')
                 .replace(/\\le/g, '≤')
                 .replace(/\\ge/g, '≥')
                 .replace(/sqrt\(([^)]+)\)/g, '√($1)');

  return result;
}

function formatExponents(str: string): string {
  let result = str.replace(/\^([0-9+\-nxyabcdefgikmprstuvwz()]+)/g, (match, p1) => {
    const clean = p1.replace(/[()]/g, '');
    return clean.split('').map((char: string) => superscripts[char] || char).join('');
  });
  result = result.replace(/\^([0-9+\-nxyabcdefgikmprstuvwz])/g, (match, p1) => {
    return superscripts[p1] || match;
  });
  return result;
}

function formatSubscripts(str: string): string {
  let result = str.replace(/_([0-9+\-aeioruxvhklmnpst()]+)/g, (match, p1) => {
    const clean = p1.replace(/[()]/g, '');
    return clean.split('').map((char: string) => subscripts[char] || char).join('');
  });
  result = result.replace(/_([0-9+\-aeioruxvhklmnpst])/g, (match, p1) => {
    return subscripts[p1] || match;
  });
  return result;
}
