export const ID = "monolith-player";

export const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

/** Localização: chaves em MONOLITH_PLAYER.<caminho> (lang/pt-BR.json). */
export function t(chave, dados) {
  const k = `MONOLITH_PLAYER.${chave}`;
  return dados ? game.i18n.format(k, dados) : game.i18n.localize(k);
}

export const cfg = (chave) => game.settings.get(ID, chave);

/** Só o Mestre ativo escreve o estado vindo do player (troca de faixa, posição). */
export const mestreAtivo = () => game.user.isGM && game.users.activeGM === game.user;

/**
 * Lê um link do YouTube: playlist (list=), vídeo (watch?v=, youtu.be, shorts, embed) ou o id puro.
 * Retorna { lista, video } (os dois podem vir juntos) ou null.
 */
export function lerLink(texto) {
  const s = String(texto ?? "").trim();
  if (!s) return null;
  const lista = s.match(/[?&]list=([\w-]+)/)?.[1] ?? (/^(PL|OL|UU|FL|LL)[\w-]{10,}$/.test(s) ? s : null);
  const video = s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/)?.[1] ?? (/^[\w-]{11}$/.test(s) ? s : null);
  return lista || video ? { lista, video } : null;
}

/** Nome sugerido para um link: playlist pela API (precisa de chave), vídeo pelo noembed (sem chave). */
export async function nomeDoLink({ lista, video }) {
  try {
    const chave = cfg("apiKey");
    if (lista && chave) {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${lista}&key=${chave}`);
      const d = await r.json();
      if (d.error) ui.notifications.warn(t("aviso.chave"));
      return d.items?.[0]?.snippet?.title ?? null;
    }
    if (!lista && video) {
      const r = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${video}`);
      return (await r.json()).title ?? null;
    }
  } catch (err) {
    console.warn(`${ID} | nome do link`, err);
  }
  return null;
}
