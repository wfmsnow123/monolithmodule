# Monolith: Player

Música do YouTube para a mesa, sincronizada entre o Mestre e os jogadores. O vídeo não aparece: o player toca fora da tela e só o som chega à mesa. Foundry 13.

Substitui o YouTube Player (`fvtt-youtube-player`). Não ative os dois juntos.

## Uso (Mestre)

1. Nos controles de Token, à esquerda, clique no ícone de **nota musical**. Abre a janela do player.
2. **Playlists** abre as playlists salvas. Clique em **+**, cole o link de uma playlist do YouTube (ou de um vídeo, que toca em loop), dê um nome e **Salvar**.
3. O **▶** ao lado da playlist toca para a mesa inteira.
4. Na janela do player: **Tocar**, **Pausar**, **Parar** e, em playlists, faixa anterior e próxima.

A playlist dá a volta ao chegar ao fim. Vídeos privados, removidos ou que não podem ser incorporados são pulados.

## Jogadores

Escutam sozinhos, sem nenhuma tela. O volume segue o controle **Música** da aba Playlists do Foundry, de cada um. O navegador só libera o som depois do primeiro clique na página.

## Chave da API do YouTube (opcional)

Tocar não precisa de chave. Com ela, uma playlist salva sem nome recebe o nome do YouTube. A chave é grátis:

1. Em console.cloud.google.com, crie um projeto.
2. APIs e serviços → Biblioteca → **YouTube Data API v3** → Ativar.
3. APIs e serviços → Credenciais → Criar credenciais → **Chave de API**.
4. Cole em Configurar Definições → Monolith: Player.

## API

`game.modules.get("monolith-player").api`: `abrir()`, `playlists()`, `tocar()`, `pausar()`, `parar()`, `proxima()`, `anterior()`, `tocarPlaylist(id)`.
