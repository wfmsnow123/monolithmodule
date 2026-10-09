# Monolith: Itemizador (módulo do Foundry)

Foundry 13, dnd5e 5. Transforma um jornal em item: o jogador carrega o documento na ficha, como qualquer outro item, e lê quando quiser.

## Criar

- **Arraste** o jornal (ou uma página dele) da barra lateral para a ficha do personagem.
- Ou use **Transformar em item** no cabeçalho do jornal, ou botão direito no jornal da barra lateral.

Na janela você escolhe nome, ícone, peso, preço, uma descrição curta (o que se vê por fora), quais páginas entram, e para quem vai: um personagem ou os Itens do mundo (pasta **Documentos**). O item é um saque do tipo **Documento**.

## Ler

Usar o item (clicar no nome ou no ícone na ficha) abre o documento. A ficha do item também tem o botão **Ler** no cabeçalho. O documento aparece com o tema escolhido no **Monolith: Journals**; sem tema, em papel simples.

- **Mostrar**: quem tem o item (ou o Mestre) mostra o documento na tela de todos.
- **Jornal** (só o Mestre): abre o jornal de origem.

## Como funciona

O item guarda uma cópia do texto das páginas escolhidas. Por isso o jogador lê sem precisar de permissão no jornal, e o documento continua com ele se for trocado, vendido ou roubado. Com **Manter sincronizado** ligado, editar o jornal (ou trocar o tema dele) atualiza todos os itens que vieram dele. Desligado, o item fica com a versão do momento em que foi criado, como um papel que já saiu da gaveta.

Segredos (blocos secretos do editor) só aparecem para o Mestre.

## Configurações

- Ícone padrão dos documentos.
- Peso padrão.
- Jogadores podem itemizar: arrastar para a própria ficha um jornal que eles já podem ver.

## API

`game.modules.get("monolith-itemizador").api`: `itemizar(journal, {actor, paginas})`, `ler(item)`, `sincronizar(journal)`, `capturar(journal, paginas)`, `itensDoJornal(journal)`, `ehDocumento(item)`. Os dados ficam em `flags.monolith-itemizador.doc` do item.
