"""Gera data/itens.json do Monolith: Itens & Miscelânea.

Preços do livro (Valores & Moedas, cardápio de Artênis): Mon = pc, Lysar = pp, Cithin = pe, Aurel = po,
Telun = pl. Faixas do livro viram o valor do meio ("taberna simples"). Ícones: os do próprio Foundry V13.
Peso em libras, como o resto do dnd5e da mesa.

Uso: python fonte/gerar_itens.py
"""
import json, os, re, unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "..", "data", "itens.json")

F, D, G, V, M, N, P, E = ("icons/consumables/food/", "icons/consumables/drinks/", "icons/consumables/grains/",
                          "icons/consumables/vegetable/", "icons/consumables/meat/", "icons/consumables/nuts/",
                          "icons/consumables/plants/", "icons/consumables/eggs/")
FR, MU = "icons/consumables/fruit/", "icons/consumables/mushrooms/"
CH, BK, HD, FT, HN, WS, SH = ("icons/equipment/chest/", "icons/equipment/back/", "icons/equipment/head/",
                              "icons/equipment/feet/", "icons/equipment/hand/", "icons/equipment/waist/",
                              "icons/equipment/shield/")

itens = []

def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def item(nome, pasta, tipo, img, preco, peso, desc, **extra):
    itens.append({"id": extra.pop("id", slug(nome)), "nome": nome, "pasta": pasta, "tipo": tipo, "img": img,
                  "preco": preco, "peso": peso, "descricao": f"<p>{desc}</p>", **extra})

def comida(nome, pasta, img, preco, peso, desc, **k): item(nome, pasta, "comida", img, preco, peso, desc, **k)
def bebida(nome, pasta, img, preco, peso, desc, **k): item(nome, pasta, "bebida", img, preco, peso, desc, **k)

# ---------- Pratos do cardápio de Artênis (livro) ----------
PR = "Comida/Pratos de taverna"
comida("Mingau quente", PR, F + "bowl-stew-tofu-potato-brown.webp", "2 pc", 1, "Trigo grosso cozido no leite e engrossado com gema. O desjejum de quem acorda antes do sol.")
comida("Ensopado de legumes", PR, F + "bowl-stew-brown.webp", "3 pc", 1, "Cenoura, raiz de salsa, pera e repolho num caldo grosso. Rende o dia inteiro na panela da taberna.")
comida("Salada de raízes", PR, F + "bowl-salad-green.webp", "3 pc", 0.5, "Cenoura, pastinaca e nabo crus, cortados fino e temperados com vinagre de vinho.")
comida("Funges", PR, MU + "crimini-button-brown.webp", "4 pc", 0.5, "Alho-poró e cogumelos refogados com açafrão. Barato para o cheiro que faz.")
comida("Torta de cebola", PR, G + "pastry-bread-brown.webp", "5 pc", 1, "Massa rústica recheada de cebola cozida devagar até ficar doce.")
comida("Empada de frango", PR, G + "pastry-bread-brown.webp", "7 pc", 1, "Frango desfiado com sálvia numa massa fechada. Viaja bem embrulhada em pano.", id="empada-de-frango")
comida("Torta de carne", PR, G + "bread-loaf-orange.webp", "8 pc", 1, "Carne picada e cebola sob uma tampa de massa grossa. A mais pedida nas tabernas de estrada.")
comida("Salomene", PR, F + "plate-fish-grilled-brown.webp", "1 pp", 1, "Filé de peixe frito servido sobre arroz. Melhor perto do rio, onde o peixe chega no mesmo dia.")
comida("Mawmeny", PR, F + "plate-steak-grilled-brown-green.webp", "1 pp", 1, "Carne desfiada num molho escuro e grosso, de especiarias e vinho reduzido.")
comida("Veado na manteiga de alho", PR, F + "steak-cooked-grilled-brown.webp", "2 pp", 1.5, "Lombo de veado assado e regado com manteiga de alho. Prato de caçador e de feriado.")
comida("Rique-manger", PR, F + "plate-chicken-grilled-mushroom-brown.webp", "1 pp", 1, "Maçã frita com ovos batidos e açafrão. Doce e salgado ao mesmo tempo.")
comida("Cinnamon brennet", PR, F + "shank-meat-bone-glazed-brown.webp", "2 pp", 1.5, "Carne cozida no vinho com canela e amêndoas. Caro, perfumado, de mesa de festa.")

# ---------- Sobremesas (livro) ----------
SB = "Comida/Sobremesas"
comida("Pão torcido de leite e açúcar", SB, G + "bread-loaf-boule-tan.webp", "3 pc", 0.5, "Massa de leite trançada e polvilhada de açúcar.")
comida("Mousse de maçã", SB, F + "berries-cream-bowl-mint-red.webp", "4 pc", 0.5, "Maçã cozida e batida até virar creme, servida fria na tigela.")
comida("Bolo de gengibre", SB, G + "pastry-bread-brown.webp", "5 pc", 0.5, "Bolo escuro e úmido, de gengibre e mel. Dura dias sem endurecer.")
comida("Pudim de uva", SB, F + "preserves-jam-jelly-jar-brown-red.webp", "5 pc", 0.5, "Uva cozida com farinha e açúcar até firmar. Sobremesa de fim de colheita.")
comida("Amêndoas açucaradas", SB, N + "almond-shelled-brown.webp", "5 pc", 0.25, "Amêndoas cobertas de calda de açúcar endurecida. Vendidas em cartucho de papel.")
comida("Barras de tâmara", SB, F + "dried-fruit-candy-brown.webp", "5 pc", 0.25, "Tâmaras prensadas com nozes em tabletes. Doce de viagem.")
comida("Torta de arroz", SB, G + "pastry-bread-brown.webp", "7 pc", 0.5, "Arroz cozido no leite, assado em massa até dourar por cima.")
comida("Peras em calda", SB, FR + "pear-ripe-yellow.webp", "7 pc", 0.5, "Peras inteiras cozidas em vinho e mel.")

# ---------- Petiscos de taverna (livro: nomes de monstro, coisa comum) ----------
PT = "Comida/Petiscos de taverna"
for nome, img, preco, desc in [
    ("Queijo de rochedo", F + "cheese-cube-gold.webp", "5 pc", "Cubos de queijo duro e salgado, cortados em pedras irregulares."),
    ("Pão de goblin", G + "bread-loaf-sliced-wheat-brown.webp", "3 pc", "Pão escuro, pequeno e torto. Ninguém sabe de onde veio o nome; todo mundo pede."),
    ("Ovos de basilisco", E + "eggs-white.webp", "6 pc", "Ovos cozidos marinados em vinagre e páprica, de casca tingida."),
    ("Cogumelos de Calignis", MU + "convex-bolete-brown.webp", "6 pc", "Cogumelos inteiros na manteiga e no alho, servidos no espeto."),
    ("Mini dracowings", F + "cooked-drumstick-chicken-turkey-brown.webp", "7 pc", "Asinhas de frango apimentadas e tostadas na brasa."),
    ("Olho de grifo", E + "egg-broken-yolk-yellow.webp", "1 pp", "Ovo frito sobre uma rodela de pão com toucinho. A gema é o olho."),
    ("Patas de aranha gigante", M + "crab-leg-shell-white-red.webp", "1 pp", "Patas de caranguejo assadas, quebradas na mesa."),
    ("Dentes de troll", N + "chestnut-roasted-brown-white.webp", "1 pp", "Castanhas assadas na casca, servidas quentes num cone."),
    ("Nuggets de beholder", F + "drumstick-fried-brown.webp", "1 pp", "Bolinhos de carne empanados e fritos."),
    ("Tentáculos de kraken", M + "octopus-tentacle-cut-purple.webp", "1 pp", "Lula frita em anéis, com sal grosso."),
    ("Lâminas de dragão", F + "dried-meat-jerky-fish-red.webp", "1 pp", "Tiras de carne seca curada com pimenta. Duras de mastigar."),
]:
    comida(nome, PT, img, preco, 0.25, desc)
bebida("Néctar de fada", PT, D + "pitcher-dripping-white.webp", "2 pp", 0.5, "Mel diluído com frutas silvestres, servido frio da adega. Doce demais para quem não é criança.")

# ---------- Bebidas (livro) ----------
BB = "Bebidas"
bebida("Água", BB, D + "water-jug-clay-brown.webp", "1 pc", 1, "Uma caneca de água limpa. Fora das cidades, ninguém garante que esteja.")
bebida("Leite", BB, D + "pitcher-dripping-white.webp", "1 pc", 1, "Leite fresco do dia. Dos Belblossom, se for em Valenda.")
bebida("Chá", BB, D + "tea-jug-gourd-brown.webp", "2 pc", 0.5, "Infusão quente de folhas e ervas da estação.")
bebida("Cerveja comum", BB, D + "alcohol-beer-mug-yellow.webp", "2 pc", 1, "Cerveja clara e rala, de lúpulo da região. A caneca de todo dia.")
bebida("Sidra", BB, D + "alcohol-beer-stein-wooden-brown.webp", "4 pc", 1, "Sidra de maçã, turva e azeda, dos pomares de Caezar.")
bebida("Hidromel", BB, D + "alcohol-jug-spirits-brown.webp", "5 pc", 1, "Mel fermentado, doce e traiçoeiro.")
bebida("Destilado", BB, D + "alcohol-jar-spirits-gray.webp", "6 pc", 0.5, "Aguardente de cereal ou de fruta, servida num copo pequeno. Esquenta o peito.")
bebida("Vinho doce de fruta", BB, D + "wine-amphora-clay-pink.webp", "8 pc", 1, "Vinho de ameixa, cereja ou amora, adoçado com mel.")
bebida("Vinho tinto envelhecido", BB, D + "wine-amphora-clay-red.webp", "2 pp", 1, "Tinto de barril, guardado anos em adega. Taça.")
bebida("Garrafa de cerveja comum", BB, D + "alcohol-beer-stein-wooden-metal-brown.webp", "2 pp", 2, "Garrafa de cerveja da casa, para levar.", porcoes=4)
bebida("Garrafa de sidra", BB, D + "alcohol-spirits-bottle-green.webp", "2 pp", 2, "Garrafa de sidra de Caezar.", porcoes=4)
bebida("Garrafa de hidromel", BB, D + "alcohol-jug-spirits-brown.webp", "3 pp", 2, "Garrafa de hidromel.", porcoes=4)
bebida("Garrafa de destilado", BB, D + "alcohol-spirits-bottle-blue.webp", "4 pp", 1.5, "Garrafa de aguardente.", porcoes=6)
bebida("Garrafa de vinho doce", BB, D + "wine-bottle-glass-white.webp", "4 pp", 2, "Garrafa de vinho doce de fruta.", porcoes=4)
bebida("Garrafa de tinto envelhecido", BB, D + "wine-amphora-clay-red.webp", "8 pp", 2, "Garrafa de vinho tinto de guarda.", porcoes=4)
bebida("Odre de água", BB, D + "water-jug-clay-brown.webp", "2 pc", 5, "Odre de couro cheio, um dia de água para uma pessoa.", porcoes=4)

# ---------- De Polésia (regionais citados na lore) ----------
PL = "Comida/De Polésia"
bebida("Vinho Belblossom", PL, D + "wine-amphora-clay-red.webp", "3 pp", 1, "O tinto da vinícola Belblossom, de Valenda, na Polésia Interior. Taça. Darius serve com queijo.")
bebida("Garrafa de vinho Belblossom", PL, D + "wine-bottle-glass-white.webp", "1 po", 2, "Garrafa selada com o brasão Belblossom. Presente de casamento em Valenda.", porcoes=4)
comida("Queijo curado Belblossom", PL, F + "cheese-wheel-round-yellow.webp", "4 pp", 2, "Queijo curado nas cavernas-adega de Valenda, de receita guardada pela família Belblossom. Uma peça pequena.", porcoes=6)
comida("Queijo envelhecido de Varenholdt", PL, F + "cheese-wedge-swiss-yellow.webp", "6 pp", 1, "Uma das últimas peças da vila de Varenholdt, abandonada. Ainda aparece em despensas de Valenda, cada vez mais cara.", porcoes=4)
comida("Pão de centeio do Moinho do Sern", PL, G + "bread-loaf-boule-rustic-brown.webp", "2 pc", 1, "Pão escuro da padaria Grãos do Centeio, feito com farinha do Moinho do Sern.", porcoes=2)
comida("Rosca da Grãos do Centeio", PL, G + "donut-baked-brown.webp", "2 pc", 0.25, "Rosca doce de Valenda, assada de manhã cedo.")
comida("Doce de vinho da Bennett", PL, F + "preserves-jam-jelly-jar-brown-red.webp", "3 pp", 0.5, "Calda de vinho envelhecido com frutas da estação, da confeitaria Bennett. Vendido na Feira de Primar.")
comida("Bolinho de queijo curado da Bennett", PL, G + "pastry-bread-brown.webp", "1 pp", 0.25, "Massa amanteigada recheada de queijo curado. Caro, como tudo da Bennett.")
comida("Salmão defumado de Foz Clara", PL, M + "salmon-fish-fillet-pink-gray.webp", "8 pc", 1, "Salmão do rio, defumado pelos pescadores de Foz Clara, no sul de Polésia.", porcoes=2)
comida("Sanduíche de carne temperada", PL, G + "bread-loaf-sliced-wheat-brown.webp", "5 pc", 0.5, "Pão recém-assado com carne bem temperada. Comida de beira de estrada no sul.")
comida("Peixe salgado de Elendor", PL, M + "fish-whole-blue.webp", "4 pc", 1, "Peixe de rio escalado e salgado nos barris do porto de Elendor.", porcoes=2)
comida("Pão de Zekes", PL, G + "bread-loaf-wheat-brown.webp", "3 pc", 1, "Pão grande e redondo, partido em pedaços e repartido no Banquete de Zekes, depois da colheita.", porcoes=4)

# ---------- Mercado (livro) ----------
MC = "Comida/Mercado"
comida("Pão de trigo", MC, G + "bread-loaf-wheat-brown.webp", "2 pc", 2, "Um pão de trigo de cerca de um quilo.", porcoes=4)
comida("Pedaço de queijo", MC, F + "cheese-wedge-swiss-white.webp", "3 pc", 0.5, "Um pedaço de queijo fresco do mercado.", porcoes=2)
comida("Frango inteiro", MC, F + "chicken-bird-cooked.webp", "5 pc", 3, "Frango limpo, para assar ou cozinhar.", porcoes=4)
comida("Carne de gado", MC, M + "steak-raw-red-pink.webp", "8 pc", 1, "Meio quilo de carne crua. Estraga em dois dias sem sal.", porcoes=2)
comida("Peixe fresco", MC, M + "fish-whole-blue.webp", "6 pc", 1, "Peixe do dia, inteiro.", porcoes=2)
comida("Ovos", MC, E + "eggs-white.webp", "2 pc", 0.5, "Meia dúzia de ovos de galinha.", porcoes=3)
comida("Toucinho", MC, M + "side-pork-fat-skin-pink.webp", "4 pc", 1, "Toucinho salgado de porco. Dá gosto a qualquer panela.", porcoes=4)
comida("Linguiça defumada", MC, F + "sausage-bratwurst-mustard-red-yellow.webp", "5 pc", 0.5, "Linguiça de porco defumada, de pendurar na cozinha.", porcoes=2)
comida("Presunto defumado", MC, F + "cooked-grilled-ham-hock-glazed-brown.webp", "3 pp", 5, "Pernil inteiro, curado e defumado. Aguenta o inverno.", porcoes=10)
comida("Manteiga", MC, F + "cheese-cube-orange.webp", "3 pc", 0.5, "Manteiga salgada em pote de barro.", porcoes=4)
comida("Mel", MC, F + "honey-beehive-brown.webp", "6 pc", 1, "Pote de mel de abelha. Adoça, conserva e cura garganta.", porcoes=6)

# ---------- Frutas e castanhas (outono é Colheita; Ashka abre a estação) ----------
FC = "Comida/Frutas e castanhas"
for nome, img, preco, desc in [
    ("Maçã", FR + "apple-red-tree-green.webp", "1 pc", "Maçã dos pomares de Caezar. A fruta mais comum do outono polesiano."),
    ("Pera", FR + "pear-ripe-yellow.webp", "1 pc", "Pera madura, doce e granulada."),
    ("Uvas", FR + "grapes-bunch-purple.webp", "2 pc", "Um cacho de uvas de mesa, da época da vindima."),
    ("Ameixas", FR + "plum-ripe-purple.webp", "1 pc", "Um punhado de ameixas roxas."),
    ("Marmelo", FR + "quince-ripe-yellow.webp", "1 pc", "Duro e azedo cru; vira doce no tacho."),
    ("Cerejas", FR + "cherry-stemmed-red.webp", "2 pc", "Cerejas da primavera, em conserva fora da estação."),
    ("Figos", FR + "fig-ripe-purple.webp", "2 pc", "Figos maduros do fim do verão."),
    ("Amoras silvestres", FR + "berry-bunch-red-green.webp", "1 pc", "Colhidas na beira da estrada, de graça para quem tem paciência com espinho."),
    ("Morangos silvestres", FR + "strawberry-ripe-red.webp", "2 pc", "Pequenos e perfumados, da mata."),
    ("Maçãs secas", F + "dried-fruit-candy-brown.webp", "2 pc", "Rodelas de maçã secas ao sol. Duram meses."),
    ("Castanhas", N + "chestnut-american-green-brown.webp", "1 pc", "Castanhas do outono, para assar na brasa."),
    ("Nozes", N + "walnut-shell-brown.webp", "2 pc", "Um punhado de nozes com casca."),
    ("Avelãs", N + "hazelnuts-shelled-whole.webp", "2 pc", "Avelãs descascadas."),
    ("Azeitonas", FR + "olives-stem-black.webp", "3 pc", "Azeitonas curtidas em salmoura."),
]:
    comida(nome, FC, img, preco, 0.25, desc)

# ---------- Legumes e raízes ----------
LG = "Comida/Legumes e raízes"
for nome, img, preco, desc in [
    ("Cenouras", V + "root-carrot-orange.webp", "1 pc", "Um maço de cenouras."),
    ("Nabos", V + "root-turnip-yellow.webp", "1 pc", "Nabos de inverno, de raiz grossa."),
    ("Pastinacas", V + "root-parsnip-grey.webp", "1 pc", "Raiz branca e adocicada, base dos ensopados."),
    ("Repolho", V + "cabbage-head-leafy-green.webp", "1 pc", "Uma cabeça de repolho. Vira chucrute no barril."),
    ("Alho-poró", V + "leek-onion-green.webp", "1 pc", "Um maço de alho-poró."),
    ("Cebolas", V + "onion-yellow.webp", "1 pc", "Três cebolas amarelas."),
    ("Alho", V + "garlic-white.webp", "1 pc", "Uma cabeça de alho. Há quem pendure na porta."),
    ("Ervilhas", V + "peas-pods-green.webp", "1 pc", "Vagens de ervilha, frescas ou secas."),
    ("Favas secas", V + "lima-beans-pod-brown.webp", "1 pc", "Favas secas, para a sopa do inverno."),
    ("Abóbora", V + "squash-pumpkin-flat-orange.webp", "2 pc", "Abóbora de casca dura. Guarda bem até a primavera."),
    ("Beterrabas", V + "root-beet-bulb-purple.webp", "1 pc", "Beterrabas roxas, que tingem tudo que tocam."),
    ("Cogumelos do bosque", MU + "umbonate-brown.webp", "2 pc", "Cogumelos colhidos no outono. Quem não conhece, não come."),
]:
    comida(nome, LG, img, preco, 0.5, desc)

# ---------- Viagem ----------
VG = "Comida/Viagem"
comida("Ração de viagem", VG, G + "breadsticks-crackers-wrapped-ration-brown.webp", "5 pc", 2, "Um dia de comida seca: carne seca, pão duro e fruta em conserva, embrulhados em pano encerado.")
comida("Rações para 5 dias", VG, G + "breadsticks-crackers-wrapped-ration-brown.webp", "2 pp", 10, "Cinco dias de carne seca, pão duro e fruta em conserva.", porcoes=5)
comida("Rações para 10 dias", VG, G + "sacks-grain-white.webp", "5 pp", 20, "Dez dias de rações num saco de lona.", porcoes=10)
comida("Biscoito duro", VG, G + "breadsticks-crackers-wrapped-ration-brown.webp", "1 pc", 0.5, "Biscoito de marinheiro, assado duas vezes. Amolece na sopa ou na saliva.", porcoes=2)
comida("Carne seca", VG, F + "dried-meat-jerky-fish-red.webp", "3 pc", 0.5, "Tiras de carne salgada e seca ao vento.", porcoes=2)

# ---------- Ingredientes (livro: mercado e ofícios) ----------
IG = "Ingredientes"
def ingrediente(nome, img, preco, peso, desc): item(nome, IG, "ingrediente", img, preco, peso, desc)
ingrediente("Sal", F + "salt-seasoning-spice-pink.webp", "2 pp", 2, "Um quilo de sal grosso. Conserva carne, peixe e, dizem, a porta de casa.")
ingrediente("Especiarias comuns", F + "spice-anise-pod.webp", "2 pp", 0.1, "Canela, gengibre e cravo para uma panela.")
ingrediente("Açafrão", P + "dried-herb-bundle-brown.webp", "4 pp", 0.1, "Estigmas de açafrão para uma receita. Raro e caro.")
ingrediente("Ervas secas", P + "herb-tied-bundle-dried-yellow.webp", "2 pc", 0.1, "Maço de sálvia, tomilho e louro.")
ingrediente("Farinha de trigo", G + "sack-rice-flour-brown.webp", "2 pc", 5, "Saco pequeno de farinha do Moinho do Sern.")
ingrediente("Farinha de centeio", G + "sack-grain-open-white.webp", "1 pc", 5, "Farinha escura de centeio.")
ingrediente("Aveia", G + "sack-oats-glowing-white.webp", "1 pc", 5, "Aveia em grão, para mingau ou para cavalo.")
ingrediente("Arroz", G + "sack-rice-open-brown.webp", "3 pc", 5, "Arroz trazido pelos barcos do rio.")
ingrediente("Açúcar", G + "sack-grain-open-white.webp", "1 pp", 1, "Açúcar de pão, raspado na hora.")
ingrediente("Vinagre de vinho", D + "wine-bottle-glass-white.webp", "3 pc", 1, "Vinagre das vinhas de Valenda.")
ingrediente("Banha", F + "cheese-cube-orange.webp", "2 pc", 1, "Banha de porco em pote, para fritar e conservar.")
ingrediente("Lúpulo", P + "herb-tied-bundle-green.webp", "3 pc", 0.25, "Uma porção de lúpulo seco, para cerveja.")

# ---------- Roupas (o livro não traz regra de CA para roupa: inventado para a mesa) ----------
# Peça de corpo conta como armadura leve: CA 8 (pano fino, roupa de dormir, trapo) ou 10 (roupa inteira) + Des.
# Acessórios (botas, chapéu, luvas, capa) não mexem na CA.
RC, RA = "Roupas/Corpo", "Roupas/Acessórios"
def roupa(nome, img, preco, peso, ca, desc):
    item(nome, RC, "roupa", img, preco, peso, desc + f" CA {ca} + Destreza.", armadura={"tipo": "light", "ca": ca, "proficiente": True})
def acessorio(nome, img, preco, peso, desc):
    item(nome, RA, "roupa", img, preco, peso, desc, armadura={"tipo": "clothing"})
roupa("Trapos", CH + "shirt-simple-tattered-grey.webp", "1 pc", 2, 8, "Pano remendado que já foi roupa.")
roupa("Camisola de dormir", CH + "shirt-simple-white.webp", "2 pp", 1, 8, "Linho fino e comprido, de dormir.")
roupa("Roupa de baixo de linho", CH + "shirt-simple-white.webp", "1 pp", 1, 8, "Camisa e ceroulas de linho cru.")
roupa("Roupas comuns", CH + "shirt-collared-brown.webp", "5 pp", 3, 10, "Camisa folgada, calças ou saia de lã e cinto. O que todo mundo veste em Polésia.")
roupa("Roupas de trabalho", CH + "vest-leather-brown.webp", "6 pp", 4, 10, "Lã grossa e avental de couro, de quem trabalha na lavoura, na ferraria ou no curtume.")
roupa("Roupas de viajante", CH + "vest-cloth-tattered-tan.webp", "2 po", 4, 10, "Lã encorpada, bolsos fundos e tecido que aguenta chuva e estrada.")
roupa("Vestido simples", CH + "robe-layered-teal.webp", "6 pp", 3, 10, "Vestido de lã com corpete amarrado e avental.")
roupa("Gibão acolchoado", CH + "coat-collared-red.webp", "8 pp", 4, 10, "Casaco curto e justo, acolchoado, com mangas de amarrar. A moda das cidades.")
roupa("Roupas finas", CH + "coat-collared-red-gold.webp", "2 po", 6, 10, "Seda, veludo e bordado, no corte que o alfaiate Jakob Zenik faz para os ricos de Valenda.")
roupa("Traje de corte", CH + "robe-layered-blue.webp", "8 po", 8, 10, "Azul e dourado, as cores do palácio de Solmere. Para audiências e bailes.")
roupa("Vestes de Solaris", CH + "robe-layered-white.webp", "8 pp", 4, 10, "Vestes brancas e douradas do clero de Solaris.")
roupa("Hábito de Zekes", CH + "robe-collared-blue.webp", "6 pp", 4, 10, "Hábito simples de lã dos irmãos de Zekes, deus da comunhão.")
roupa("Farda de guarnição", CH + "coat-collared-studded-red.webp", "1 po", 5, 10, "Farda de lã com as cores da cidade. Como a da guarnição de Elendor.")
roupa("Traje de cena", CH + "robe-collared-pink.webp", "6 pp", 4, 10, "Roupa de saltimbanco e de teatro, de cores fortes.")
acessorio("Capa de viagem", BK + "cloak-brown.webp", "1 pp", 2, "Capa de lã sem capuz, presa por um alfinete.")
acessorio("Manto com capuz", BK + "cloak-hooded-red.webp", "3 pp", 3, "Manto de lã grossa com capuz fundo.")
acessorio("Manto com brasão", BK + "cloak-collared-blue-gold.webp", "2 po", 3, "Manto com o brasão da casa ou da ordem bordado nas costas.")
acessorio("Capa de pele", BK + "cloak-brown-fur-brown.webp", "1 po", 4, "Capa forrada de pele para o inverno.")
acessorio("Botas de couro", FT + "boots-leather-brown.webp", "6 pp", 2, "Botas de cano alto, feitas para estrada.")
acessorio("Sapatos de couro", FT + "boots-collared-simple-brown.webp", "3 pp", 1, "Sapatos baixos de couro, de cidade.")
acessorio("Tamancos", FT + "boots-folded-leather-brown.webp", "2 pc", 1, "Sola de madeira e tira de couro. Barulhentos, mas não furam.")
acessorio("Chapéu de feltro", HD + "hat-belted-simple-brown.webp", "2 pp", 0.5, "Chapéu de aba larga, de feltro.")
acessorio("Boina de couro", HD + "cap-simple-leather-brown.webp", "1 pp", 0.25, "Boina curta de couro, de artesão.")
acessorio("Lenço de cabeça", HD + "headwrap-cloth-white.webp", "3 pc", 0.1, "Lenço de linho amarrado na cabeça.")
acessorio("Luvas de couro", HN + "glove-simple-leather-brown-blue.webp", "2 pp", 0.25, "Luvas de couro macio.")
acessorio("Luvas de trabalho", HN + "glove-frayed-cloth-grey.webp", "5 pc", 0.25, "Luvas de pano grosso, de lavoura e de carga.")
acessorio("Cinto de couro", WS + "belt-leather-brown.webp", "5 pc", 0.5, "Cinto simples com fivela de ferro.")
acessorio("Avental de couro", WS + "belt-buckle-ring-leather-tan.webp", "4 pc", 1, "Avental de couro de ferreiro, cozinheiro ou curtidor.")

# ---------- Armaduras (dnd5e base, nomes em português; preços do Livro do Jogador, que batem com Valores & Moedas) ----------
def armadura(nome, pasta, img, preco, peso, tipo, ca, base, desc, dex=None, forca=None, furt=False):
    item(nome, pasta, "armadura", img, preco, peso, desc,
         armadura={"tipo": tipo, "ca": ca, "dex": dex, "forca": forca, "furtividade": furt, "base": base})
AL, AM, AP, AE = "Armaduras/Leves", "Armaduras/Médias", "Armaduras/Pesadas", "Armaduras/Escudos"
armadura("Armadura acolchoada", AL, CH + "breastplate-quilted-brown.webp", "5 po", 8, "light", 11, "padded", "Camadas de pano e enchimento costuradas. Quente e barulhenta.", furt=True)
armadura("Armadura de couro", AL, CH + "breastplate-scale-leather.webp", "10 po", 10, "light", 11, "leather", "Couro curtido e endurecido no óleo. Dorme-se com ela sem perder o sono.")
armadura("Couro batido", AL, CH + "breastplate-layered-leather-studded-brown.webp", "45 po", 13, "light", 12, "studded", "Couro reforçado com rebites de metal.")
armadura("Gibão de peles", AM, CH + "vest-leather-tattered-white.webp", "10 po", 12, "medium", 12, "hide", "Peles e couros grossos, de quem vive no mato.", dex=2)
armadura("Camisão de malha", AM, CH + "breastplate-collared-steel-grey.webp", "50 po", 20, "medium", 13, "chainshirt", "Malha de anéis usada sob a roupa.", dex=2)
armadura("Brunea", AM, CH + "breastplate-metal-scaled-grey.webp", "50 po", 45, "medium", 14, "scalemail", "Escamas de metal sobre couro, com manoplas.", dex=2, furt=True)
armadura("Peitoral", AM, CH + "breastplate-cuirass-steel-grey.webp", "400 po", 20, "medium", 14, "breastplate", "Placa ajustada ao tronco. A peça de quem pode pagar ferreiro de Elendor.", dex=2)
armadura("Peitoral cerimonial polesiano", AM, CH + "breastplate-layered-gilded-orange.webp", "800 po", 22, "medium", 14, "breastplate", "Peitoral gravado em ouro e esmalte azul, de desfile e de corte. Como o que o imperador Aurelian não tira.", dex=2)
armadura("Meia-armadura", AM, CH + "breastplate-layered-steel.webp", "750 po", 40, "medium", 15, "halfplate", "Placas moldadas que cobrem quase todo o corpo.", dex=2, furt=True)
armadura("Cota de anéis", AP, CH + "breastplate-banded-leather-brown.webp", "30 po", 40, "heavy", 14, "ringmail", "Couro com anéis pesados costurados.", dex=0, furt=True)
armadura("Cota de malha", AP, CH + "breastplate-banded-steel.webp", "75 po", 55, "heavy", 16, "chainmail", "Malha de anéis entrelaçados sobre forro acolchoado.", dex=0, forca=13, furt=True)
armadura("Cota de talas", AP, CH + "breastplate-banded-steel-studded.webp", "200 po", 60, "heavy", 17, "splint", "Tiras verticais de metal rebitadas em couro.", dex=0, forca=15, furt=True)
armadura("Armadura de placas", AP, CH + "breastplate-layered-steel-grey.webp", "1500 po", 65, "heavy", 18, "plate", "Placas de aço encaixadas da cabeça aos pés. Ninguém dorme bem dentro dela.", dex=0, forca=15, furt=True)
armadura("Escudo", AE, SH + "heater-wooden-steel-boss.webp", "10 po", 6, "shield", 2, "shield", "Escudo de madeira com bossa de ferro.")
armadura("Broquel", AE, SH + "buckler-wooden-boss-steel.webp", "10 po", 6, "shield", 2, "shield", "Escudo pequeno e redondo, de punho.")

os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
ids = [i["id"] for i in itens]
assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
with open(SAIDA, "w", encoding="utf-8") as f:
    json.dump(itens, f, ensure_ascii=False, indent=1)
print(f"{len(itens)} itens em {SAIDA}")
