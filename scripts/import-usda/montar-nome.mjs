/**
 * Monta o nome em português de um alimento da USDA a partir do dicionário de partes
 * (scripts/import-usda/traducao/*.json), no padrão da TACO: "Batata, inglesa, cozida".
 *
 * Regras do dicionário:
 *   "a|b"  adjetivo: masculino|feminino — concorda com o gênero do 1º termo do nome
 *   "x#f"  substantivo feminino (x#m masculino) — o gênero vale quando ele abre o nome
 *   ""     o termo some (ex.: "Nuts", "Fish", "all grades")
 *   chave com vírgula ("Beans, snap") = expressão de vários termos, que vence os termos soltos
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PASTA = path.join(path.dirname(fileURLToPath(import.meta.url)), "traducao");

export function carregarDicionario() {
  const dicionario = {};
  for (const arquivo of fs.readdirSync(PASTA).filter((a) => /^\d+\.json$/.test(a)).sort()) {
    const parte = JSON.parse(fs.readFileSync(path.join(PASTA, arquivo), "utf8"));
    for (const [en, pt] of Object.entries(parte)) if (!en.startsWith("_")) dicionario[en] = pt;
  }
  return dicionario;
}

/** Separa por vírgula, mas não dentro de parênteses ("Chickpeas (garbanzo beans, bengal gram)"). */
export function separarPartes(nomeEnOriginal) {
  // Observação administrativa da USDA, sem valor para o nutricionista.
  const nomeEn = nomeEnOriginal.replace(/\s*\(Includes foods for USDA's Food Distribution Program\)/gi, "");
  const partes = [];
  let atual = "";
  let nivel = 0;
  for (const ch of nomeEn) {
    if (ch === "(") nivel++;
    if (ch === ")") nivel = Math.max(0, nivel - 1);
    if (ch === "," && nivel === 0) {
      partes.push(atual.trim());
      atual = "";
    } else atual += ch;
  }
  partes.push(atual.trim());
  return partes.filter(Boolean);
}

// "cooked, roasted" → só "assado": o "cozido" genérico sai quando vem o método.
const METODOS = /^(assad|ensopad|grelhad|frit|guisad|cozid[oa] em fogo baixo|refogad|na chapa|no vapor|no micro-ondas|em calor|torrad|dourad|tostad|empanad)/;

/**
 * Gênero do alimento quando o dicionário não diz: pela terminação da 1ª palavra
 * ("canela" f, "pimenta" f, "feijão" m, "infusão" f). Bom o bastante para a concordância.
 */
const MASCULINOS_EM_A = new Set(["dia", "mapa", "chá", "guaraná", "maracujá", "fubá", "cajá", "sofá", "café", "cuscuz", "alho-poró", "tempeh", "tofu"]);
const FEMININOS_SEM_A = new Set(["semente", "carne", "alface", "couve", "noz", "raiz", "flor", "pele", "ave", "fécula", "sêmola"]);
export function inferirGenero(texto) {
  const palavra = texto.toLowerCase().split(/[\s(]/)[0] ?? "";
  if (MASCULINOS_EM_A.has(palavra)) return "m";
  if (FEMININOS_SEM_A.has(palavra)) return "f";
  if (/(ção|são|dade|gem|ã)$/.test(palavra)) return "f";
  if (/a$/.test(palavra)) return "f";
  return "m";
}

function primeiraMaiuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** @returns {{ nome: string, faltando: string[] }} */
export function montarNome(nomeEn, dicionario) {
  const partes = separarPartes(nomeEn);
  const termos = []; // { texto, genero? , adjetivo?: [m, f] }
  const faltando = [];

  // Termos que dependem do alimento principal: "Milk>reduced fat" = semidesnatado só no leite.
  const principal = partes[0];

  for (let i = 0; i < partes.length; ) {
    // Expressão mais longa primeiro (até 3 termos).
    let achou = false;
    for (let n = Math.min(3, partes.length - i); n >= 1; n--) {
      const expressao = partes.slice(i, i + n).join(", ");
      const contextual = i > 0 ? `${principal}>${expressao}` : null;
      const chave = contextual && contextual in dicionario ? contextual : expressao;
      if (chave in dicionario) {
        const valor = dicionario[chave];
        if (valor !== "") {
          const [texto, genero] = valor.split("#");
          // Separa só em ", " (vírgula + espaço): "3,25% de gordura" é um termo só.
          // "cru, com x|crua, com x": as duas formas são separadas e pareadas termo a termo.
          const [formaM, formaF] = texto.split("|");
          const pedacosM = formaM.split(", ");
          const pedacosF = formaF?.split(", ");
          const pareado = pedacosF && pedacosF.length === pedacosM.length;
          const pedacos = pareado ? pedacosM : texto.split(", ");
          pedacos.forEach((pedaco, k) => {
            if (pareado) {
              termos.push(pedaco === pedacosF[k] ? { texto: pedaco } : { adjetivo: [pedaco, pedacosF[k]] });
              return;
            }
            const [m, f] = pedaco.split("|");
            termos.push(f !== undefined ? { adjetivo: [m, f] } : { texto: m, genero });
          });
          // O gênero do substantivo vale para o termo que ele abre.
          if (genero) termos[termos.length - pedacos.length].genero = genero;
        }
        i += n;
        achou = true;
        break;
      }
    }
    if (!achou) {
      faltando.push(partes[i]);
      termos.push({ texto: partes[i] });
      i += 1;
    }
  }

  const primeiro = termos.find((t) => t.texto !== undefined || t.adjetivo);
  const genero = primeiro?.genero ?? inferirGenero(primeiro?.texto ?? "");
  const textos = termos.map((t) => (t.adjetivo ? t.adjetivo[genero === "f" ? 1 : 0] : t.texto));
  // Termos repetidos seguidos (ex.: "frango" logo depois de "Frango") saem.
  const semRepetir = textos.filter((t, i) => t && t.toLowerCase() !== textos[i - 1]?.toLowerCase());
  const limpos = semRepetir.filter((t, i) => !(/^cozid[oa]$/.test(t) && METODOS.test(semRepetir[i + 1] ?? "")));
  const nome = limpos.length ? [primeiraMaiuscula(limpos[0]), ...limpos.slice(1)].join(", ") : nomeEn;
  return { nome, faltando, genero };
}
