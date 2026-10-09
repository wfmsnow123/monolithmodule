# Monolith: Player

Música do YouTube para a mesa, sincronizada entre o Mestre e os jogadores. O vídeo não aparece: o player toca fora da tela e só o som chega à mesa. Foundry 13.

Substitui o YouTube Player (`fvtt-youtube-player`). Não ative os dois juntos.

## Uso (Mestre)

A barra **Monolith · Player** fica fixa na lateral esquerda, dentro da caixa da lista de jogadores, logo abaixo da linha Monolith.
- **▶ ⏸ ■**: tocar, pausar e parar para a mesa inteira.
- **Campo de link**: cole o link de um vídeo ou de uma playlist do YouTube e aperte Enter (ou ▶) para tocar na hora, sem salvar.
- **Playlists**: abre o gerenciador, com o controle completo (o que está tocando, faixa x de y, barra de progresso em que se clica para pular, faixa anterior e próxima, volume) e as playlists salvas. Clique em **+**, cole o link, dê um nome e **Salvar**; o **▶** ao lado de cada uma toca para a mesa.
- O botão da **nota musical** nas ferramentas de Token mostra e esconde a barra.

A playlist dá a volta ao chegar ao fim. Vídeos privados, removidos ou que não podem ser incorporados são pulados.

## Jogadores

Escutam sozinhos, sem a tela do vídeo. Na barra, só veem o título e o **volume**, que vai de 0 a 100 e é de cada um: fica fora do controle de Música do Foundry, que não desce de 5. O navegador só libera o som depois do primeiro clique na página.

## Chave da API do YouTube (opcional)

Tocar não precisa de chave. Com ela, uma playlist salva sem nome recebe o nome do YouTube. A chave é grátis:

1. Em console.cloud.google.com, crie um projeto.
2. APIs e serviços → Biblioteca → **YouTube Data API v3** → Ativar.
3. APIs e serviços → Credenciais → Criar credenciais → **Chave de API**.
4. Cole em Configurar Definições → Monolith: Player.

## API

`game.modules.get("monolith-player").api`: `abrir()`, `playlists()`, `tocar()`, `pausar()`, `parar()`, `proxima()`, `anterior()`, `tocarPlaylist(id)`.
