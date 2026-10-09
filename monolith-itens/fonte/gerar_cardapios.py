"""Gera data/cardapios.json: cardápios de Polésia para mostrar à mesa.

Preços do cardápio de Artênis (Valores & Moedas): taberna simples no interior, taverna de cidade em
Solmere, Lexford e Elendor. Moedas pelo nome de Monolith (Mon, Lysar, Aurel).
Uso: python fonte/gerar_cardapios.py
"""
import json, os, re, unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "..", "data", "cardapios.json")
cardapios = []

def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def cardapio(nome, pasta, subtitulo, secoes, rodape=""):
    cardapios.append({"id": "cardapio-" + slug(nome), "nome": nome, "pasta": pasta, "subtitulo": subtitulo,
                      "rodape": rodape, "secoes": [{"titulo": t, "itens": [{"nome": i[0], "preco": i[1], **({"nota": i[2]} if len(i) > 2 else {})} for i in its]} for t, its in secoes]})

VAL, SOL, INT, FES = "Valenda", "Solmere", "Interior e estradas", "Festas da estação"

# ---------------- Valenda (Polésia Interior) ----------------
cardapio("Taverna do Hanson", VAL, "Comida quente e bom vinho local. Valenda, à beira do Sern.", [
    ("Da panela", [("Mingau quente", "2 Mon"), ("Ensopado de legumes", "3 Mon"), ("Torta de cebola", "5 Mon"), ("Torta de carne", "8 Mon")]),
    ("Do fogo", [("Empada de frango com sálvia", "7 Mon"), ("Mawmeny", "1 Lysar"), ("Veado na manteiga de alho", "2 Lysar", "quando o Tomás traz caça")]),
    ("Para beber", [("Cerveja comum", "2 Mon"), ("Sidra", "4 Mon"), ("Vinho Belblossom, taça", "3 Lysar"), ("Garrafa de vinho Belblossom", "1 Aurel")]),
    ("Quarto", [("Dormitório, por noite", "5 Mon"), ("Quarto simples", "1 Lysar"), ("Banho quente", "4 Mon")]),
], "Fiado só para quem o Hanson conhece. Velas apagadas na hora de dormir.")
cardapio("Confeitaria Bennett", VAL, "Barraca na Feira de Primar e encomendas para casamentos.", [
    ("Doces da semana", [("Pão torcido de leite e açúcar", "3 Mon"), ("Bolo de gengibre", "5 Mon"), ("Amêndoas açucaradas", "5 Mon"), ("Barras de tâmara", "5 Mon")]),
    ("Da casa", [("Bolinho de queijo curado", "1 Lysar"), ("Peras em calda de vinho e mel", "7 Mon"), ("Doce de vinho com frutas da estação", "3 Lysar", "pote")]),
    ("Encomendas", [("Bolo de casamento pequeno", "2 Aurel"), ("Bolo de casamento grande", "5 Aurel"), ("Bandeja de doces para festa", "1 Aurel")]),
], "Encomendas com uma semana de antecedência. A senhora Bennett não faz desconto.")
cardapio("Padaria Grãos do Centeio", VAL, "Pães, bolos e roscas com farinha do Moinho do Sern.", [
    ("Pães", [("Pão de centeio", "2 Mon"), ("Pão de trigo, um quilo", "2 Mon"), ("Pão de Zekes", "3 Mon", "só na semana do Banquete")]),
    ("Para o caminho", [("Rosca doce", "2 Mon"), ("Biscoito duro, dois", "1 Mon"), ("Ração de viagem, um dia", "5 Mon")]),
    ("Bolos", [("Bolo de gengibre", "5 Mon"), ("Torta de arroz", "7 Mon")]),
], "Forno aceso antes do sol. O que sobra à tarde vai para a capelinha de Zekes.")
cardapio("Vinícola Belblossom: degustação", VAL, "Vinho e queijo servidos por Darius Belblossom, nas colinas de Valenda.", [
    ("Vinhos", [("Vinho Belblossom, taça", "2 Lysar"), ("Garrafa de vinho Belblossom", "1 Aurel"), ("Vinho tinto da adega, taça", "1 Lysar")]),
    ("Da fazenda", [("Queijo curado Belblossom, prato", "1 Lysar"), ("Peça pequena de queijo curado", "4 Lysar"), ("Leite fresco", "1 Mon")]),
    ("Degustação", [("Três taças e um prato de queijo", "6 Lysar")]),
], "As cavernas-adega não são abertas a visitas.")
cardapio("Açougue do Pierce", VAL, "O único açougue de Valenda. Caça quando o Tomás volta da mata.", [
    ("Carnes", [("Carne de gado, meio quilo", "8 Mon"), ("Frango inteiro", "5 Mon"), ("Toucinho", "4 Mon"), ("Linguiça defumada", "5 Mon")]),
    ("Curados", [("Presunto defumado, pernil", "3 Lysar"), ("Carne seca", "3 Mon")]),
    ("Caça", [("Lombo de veado", "1 Lysar", "por encomenda"), ("Coelho", "4 Mon")]),
], "O Pierce não vende fiado e não pergunta de onde veio o dinheiro.")

# ---------------- Solmere (capital) ----------------
cardapio("Mercado coberto de Altobaixo", SOL, "Barracas de pescadores e curtidores, no distrito baixo de Solmere.", [
    ("Peixaria", [("Peixe fresco", "6 Mon"), ("Lula frita", "1 Lysar"), ("Patas de caranguejo", "1 Lysar")]),
    ("Hortas", [("Maço de cenouras, nabos ou pastinacas", "1 Mon"), ("Repolho", "1 Mon"), ("Abóbora", "2 Mon"), ("Cogumelos do bosque", "2 Mon")]),
    ("Pomares", [("Maçãs ou peras, três", "3 Mon"), ("Cacho de uvas", "2 Mon"), ("Castanhas, punhado", "1 Mon")]),
    ("Empório", [("Sal, um quilo", "2 Lysar"), ("Especiarias comuns", "2 Lysar"), ("Açafrão", "4 Lysar"), ("Mel, pote", "6 Mon")]),
], "Abre ao nascer do sol e fecha antes que os lampareiros terminem a ronda.")
cardapio("Casa de pasto da Arcada", SOL, "Mesa farta no distrito da Arcada, para quem tem negócio na capital.", [
    ("Entradas", [("Salada de raízes", "5 Mon"), ("Funges", "8 Mon"), ("Ovos de basilisco", "7 Mon")]),
    ("Pratos", [("Salomene", "2 Lysar"), ("Mawmeny", "2 Lysar"), ("Rique-manger", "3 Lysar"), ("Cinnamon brennet", "5 Lysar"), ("Veado na manteiga de alho", "4 Lysar")]),
    ("Sobremesas", [("Mousse de maçã", "4 Mon"), ("Pudim de uva", "6 Mon"), ("Peras em calda", "8 Mon")]),
    ("Adega", [("Vinho tinto envelhecido, garrafa", "8 Lysar"), ("Vinho Belblossom, garrafa", "2 Aurel"), ("Destilado, copo", "8 Mon")]),
], "Reservas com o maître. Não se entra armado.")
cardapio("Estalagem da Estação", SOL, "Em frente à estação da Thunderdope. Cheira a ferro, vapor e pão.", [
    ("Antes do trem", [("Mingau quente", "3 Mon"), ("Sanduíche de carne temperada", "6 Mon"), ("Leite quente com biscoito", "3 Mon")]),
    ("Para a viagem", [("Ração de viagem, um dia", "6 Mon"), ("Rações para 5 dias", "3 Lysar"), ("Odre de água", "3 Mon")]),
    ("Quartos", [("Quarto simples", "2 Lysar"), ("Quarto confortável", "4 Lysar"), ("Suíte", "2 Aurel")]),
], "Câmbio de moedas na estação, ao lado. Cuidado com bolsos no saguão.")
cardapio("Casa de chá do Pináculo", SOL, "Chás, bolos e conversa baixa, perto do Pináculo.", [
    ("Chás", [("Chá da casa", "3 Mon"), ("Chá de ervas da estação", "3 Mon"), ("Chá com leite e mel", "5 Mon")]),
    ("Para acompanhar", [("Pão torcido de leite e açúcar", "3 Mon"), ("Bolo de gengibre", "6 Mon"), ("Torta de arroz", "8 Mon")]),
    ("Dia do Chá", [("Bule servido à moda de Yoake", "1 Lysar", "4 de Zoryen")]),
], "Silêncio depois do sino da Catedral.")
cardapio("Taverna dos Lampareiros", SOL, "Onde a Guilda dos Lampareiros come depois da ronda.", [
    ("Da noite", [("Ensopado de legumes", "5 Mon"), ("Torta de carne", "1 Lysar"), ("Nuggets de beholder", "1 Lysar")]),
    ("Do balcão", [("Cerveja comum", "3 Mon"), ("Hidromel", "6 Mon"), ("Destilado", "8 Mon")]),
], "Quem chega sem lanterna depois do escuro paga a primeira rodada.")

# ---------------- Interior e estradas ----------------
cardapio("Hospedaria da Balança", INT, "Lexford, no vale baixo. Juristas, mercadores e pedreiros à mesma mesa.", [
    ("Do dia", [("Ensopado de legumes", "5 Mon"), ("Empada de frango", "1 Lysar"), ("Salomene", "2 Lysar")]),
    ("Para beber", [("Cerveja comum", "3 Mon"), ("Vinho doce de fruta", "1 Lysar"), ("Vinho tinto envelhecido", "2 Lysar")]),
    ("Quarto", [("Quarto simples", "2 Lysar"), ("Quarto confortável", "4 Lysar")]),
], "No Dia da Balança, a casa serve a primeira taça de graça.")
cardapio("Taberna do Muro", INT, "Daenish, à sombra da Muralha. Lavradores de dia, guardas de noite.", [
    ("Comida", [("Mingau quente", "1 Mon"), ("Ensopado de legumes", "2 Mon"), ("Pão de centeio com toucinho", "3 Mon"), ("Torta de carne", "6 Mon")]),
    ("Bebida", [("Cerveja comum", "2 Mon"), ("Sidra", "3 Mon"), ("Destilado", "5 Mon")]),
    ("Pouso", [("Feno no estábulo", "1 Mon"), ("Dormitório", "4 Mon")]),
], "Proibido falar de Kretânia depois da terceira caneca.")
cardapio("Casa da Sidra de Caezar", INT, "Entre os pomares e o templo de Zekes.", [
    ("Sidras", [("Sidra nova, caneca", "3 Mon"), ("Sidra velha, caneca", "5 Mon"), ("Garrafa de sidra", "1 Lysar")]),
    ("Do pomar", [("Maçãs assadas com mel", "3 Mon"), ("Rique-manger", "1 Lysar"), ("Mousse de maçã", "3 Mon"), ("Peras em calda", "5 Mon")]),
    ("Petiscos", [("Queijo de rochedo", "4 Mon"), ("Castanhas assadas", "1 Mon")]),
], "Na colheita, quem ajuda a apanhar maçã bebe de graça à noite.")
cardapio("Casa de pasto do porto de Foz Clara", INT, "Terra de trigo e de pesca, no sul de Polésia. Cheiro de sal do mar.", [
    ("Do rio e do mar", [("Salmão defumado", "8 Mon"), ("Salomene", "1 Lysar"), ("Peixe fresco grelhado", "6 Mon"), ("Lula frita", "8 Mon")]),
    ("Da terra", [("Sanduíche de carne temperada", "5 Mon"), ("Pão recém-assado", "1 Mon")]),
    ("Para beber", [("Chá", "2 Mon"), ("Cerveja comum", "2 Mon"), ("Destilado", "5 Mon")]),
], "Missa de Solaris ao amanhecer; a cozinha só abre depois.")
cardapio("Estalagem da Roda Quebrada", INT, "Taberna de estrada entre Valenda e Elendor, onde as carroças param.", [
    ("Para quem chega", [("Mingau quente", "2 Mon"), ("Ensopado de legumes", "3 Mon"), ("Torta de carne", "8 Mon")]),
    ("Para quem segue", [("Ração de viagem, um dia", "5 Mon"), ("Odre de água", "2 Mon"), ("Ração e cuidado do cavalo", "3 Mon")]),
    ("Para beber", [("Cerveja comum", "2 Mon"), ("Hidromel", "5 Mon")]),
    ("Pouso", [("Feno", "1 Mon"), ("Dormitório", "5 Mon"), ("Quarto simples", "1 Lysar")]),
], "Portões fechados ao escurecer. Quem bate depois espera o dia.")
cardapio("Cantina da Guarnição de Elendor", INT, "Rio, peixe salgado e cerveja derramada.", [
    ("Rancho", [("Peixe salgado com pão", "3 Mon"), ("Ensopado de legumes", "3 Mon"), ("Pão de goblin", "3 Mon")]),
    ("Para a ronda", [("Biscoito duro", "1 Mon"), ("Carne seca", "3 Mon")]),
    ("Balcão", [("Cerveja comum", "2 Mon"), ("Destilado", "6 Mon")]),
], "Farda abotoada à mesa. A Câmara confere as contas no fim do mês.")
cardapio("Barraca O Grifo Faminto", INT, "Petiscos de nome feio e gosto bom, de feira em feira.", [
    ("Petiscos", [("Queijo de rochedo", "5 Mon"), ("Pão de goblin", "3 Mon"), ("Ovos de basilisco", "6 Mon"), ("Cogumelos de Calignis", "6 Mon"), ("Mini dracowings", "7 Mon")]),
    ("Para os corajosos", [("Olho de grifo", "1 Lysar"), ("Patas de aranha gigante", "1 Lysar"), ("Dentes de troll", "1 Lysar"), ("Tentáculos de kraken", "1 Lysar"), ("Lâminas de dragão", "1 Lysar")]),
    ("Para as crianças", [("Néctar de fada", "2 Lysar", "servido frio")]),
], "Nenhum monstro foi ferido. Quase nenhum.")

# ---------------- Festas da estação (outono, Ashka e Zoryen) ----------------
cardapio("Banquete de Zekes", FES, "7 de Zoryen, depois da colheita. A mesa é comprida e todos sentam juntos.", [
    ("Para repartir", [("Pão de Zekes", "oferenda"), ("Ensopado de legumes", "oferenda"), ("Torta de carne", "oferenda")]),
    ("Da colheita", [("Maçãs, peras e uvas", "oferenda"), ("Castanhas assadas", "oferenda"), ("Pudim de uva", "oferenda")]),
    ("Para brindar", [("Sidra nova", "oferenda"), ("Vinho da vindima", "oferenda")]),
], "Quem come leva alguma coisa para a mesa. Quem não tem nada, leva as mãos para servir.")
cardapio("Feira do Fim do Ciclo", FES, "29 de Zoryen, antes do inverno. A última feira grande de Polésia no ano.", [
    ("Barracas de comida", [("Linguiça defumada no pão", "6 Mon"), ("Empada de frango", "7 Mon"), ("Castanhas assadas", "1 Mon"), ("Maçãs secas", "2 Mon")]),
    ("Para guardar o inverno", [("Presunto defumado", "3 Lysar"), ("Favas secas", "1 Mon"), ("Abóbora", "2 Mon"), ("Barril de chucrute", "1 Lysar")]),
    ("Doces", [("Amêndoas açucaradas", "5 Mon"), ("Bolo de gengibre", "5 Mon"), ("Doce de vinho da Bennett", "3 Lysar")]),
    ("Para beber", [("Cerveja comum", "2 Mon"), ("Hidromel", "5 Mon"), ("Vinho doce de fruta", "8 Mon")]),
], "As barracas fecham com o sino do meio-dia. Depois, cada um para a sua casa e as suas velas.")
cardapio("Dia do Cervejeiro e do Cozinheiro", FES, "21 de Zoryen. Tabernas de portas abertas e cozinheiros na rua.", [
    ("Cervejas da festa", [("Cerveja comum, caneca", "1 Mon"), ("Cerveja de lúpulo novo", "3 Mon"), ("Hidromel", "4 Mon")]),
    ("Da rua", [("Mini dracowings", "6 Mon"), ("Nuggets de beholder", "8 Mon"), ("Sanduíche de carne temperada", "5 Mon")]),
    ("Concurso", [("Prato do cozinheiro vencedor", "1 Lysar", "sai às quatro da tarde")]),
], "Quem passar mal paga a limpeza.")

os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
assert len(cardapios) == 20, len(cardapios)
with open(SAIDA, "w", encoding="utf-8") as f:
    json.dump(cardapios, f, ensure_ascii=False, indent=1)
print(f"{len(cardapios)} cardápios em {SAIDA}")
