# Kikiu — fotos para tirar

> Lista do que falta fotografar para a home virar vitrine em vez de cardápio.
> Escrita em 16/09/2026, conferindo arquivo por arquivo o que o site pede e o
> que existe na pasta.

## O que a casa já tem

| | |
|---|---|
| topo do site (`hero.jpg`) | ✅ |
| prévia do WhatsApp (`og.jpg`) | ✅ |
| fachada (`porta.jpg`) | ✅ |
| drinks | ✅ **11 fotos** — a ~330×460 |

As 11 servem para a ficha do cardápio. Para a vitrine da home ficam pequenas
demais — a foto sobe borrada quando ocupa meia tela.

## O que falta

### 1. Os quatro drinks da vitrine — **é o que mais importa**

O cardápio do Kikiu tem **115 itens**, quase tudo bebida. Ninguém decide sair
de casa lendo 115 linhas de preço — decide vendo **um** copo.

Escolha quatro com os sócios. Os "Drinks Casa Pro" são a cara da casa e o
lugar certo para procurar. De cada um: copo inteiro, **contraluz ou luz baixa
do bar**, fundo escuro, formato `prato`.

Um detalhe que muda tudo em foto de drink: **fotografe assim que montar**, com
o gelo ainda inteiro e a espuma viva. Dois minutos depois já é outro copo.

### 2. A caneca de chopp gelada — **tem um desenho no lugar dela hoje**

A home ganhou o destaque do **chopp em dobro (segunda e terça)**. Como não
existe foto de caneca nenhuma, ali está um desenho em traço, no mesmo estilo
da taça do topo. Funciona, mas desenho não dá sede.

A foto que substitui: **caneca suando**, com a espuma ainda alta e o vidro
embaçado de gelo. Contraluz do bar, fundo escuro. Formato `prato`.

Duas coisas decidem essa foto:

- **fotografe nos primeiros trinta segundos.** Passou disso, a espuma baixa e
  o embaçado escorre — vira uma caneca comum.
- **tire a caneca do freezer na hora.** O branco no vidro é o que comunica
  "zero grau" sem precisar escrever.

### 3. O bar em serviço

O balcão com o bartender trabalhando, garrafas ao fundo, movimento. É o que
diferencia um gastrobar de um restaurante que também vende cerveja. Formato
`galeria`.

### 4. Uma noite com música ao vivo

A home tem seção de agenda e eventos. Uma foto de casa cheia com o show
acontecendo vende as duas de uma vez. Formato `galeria`.

### 5. A chapa / os steaks

A seção "Steaks & Chapas" existe no cardápio e não tem foto nenhuma. Uma foto
de carne saindo da chapa, formato `prato`.

## Como entregar cada foto

Tire tudo no **maior tamanho que o celular deixar** e me mande o original. O
corte, o tamanho e a limpeza dos dados são feitos por um comando — não corte
nada à mão, e não mande print de tela.

**No seu PC (PowerShell)**, com a foto já baixada:

```
python3 scripts/otimizar-fotos.py C:\caminho\da\foto.jpg assets/img/bar/hero.jpg hero
```

Trocando o último pedaço pelo formato de cada uma:

| formato | tamanho | onde aparece |
|---|---|---|
| `hero` | 1920×1080 | a foto grande do topo do site |
| `og` | 1200×630 | **a prévia quando alguém manda o link no WhatsApp** |
| `prato` | 1000×1250 | a vitrine da home e as fichas do cardápio |
| `galeria` | 1200×1200 | bloco de ambiente |
| `porta` | 900×1400 | a fachada, em retrato |

O comando gira a foto pelo EXIF antes de cortar (foto de celular vem deitada
com uma etiqueta dizendo que está em pé) e **apaga o EXIF depois** — essa
etiqueta carrega o GPS de onde a foto foi tirada e o modelo do aparelho, e
isso não tem por que subir para a internet.

## Três regras que valem mais que equipamento

1. **Luz de janela, nunca o flash.** Flash de celular achata a comida e deixa
   a cor doente. Mesa perto da janela, no fim da tarde, é melhor do que
   qualquer equipamento.
2. **Fotografe o prato como ele sai**, não uma montagem especial. Cliente que
   vê uma coisa no site e recebe outra na mesa não volta.
3. **Casa cheia vale mais que casa vazia.** Salão vazio parece que ninguém
   quer ir. Peça para a equipe sentar nas mesas se precisar.
