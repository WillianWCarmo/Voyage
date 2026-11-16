require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const noticias = [
  {
    id: 'voyage-chega-taquaritinga',
    title: 'Novidade: Voyage chega a Taquaritinga!',
    summary: 'Taquaritinga agora faz parte das regiões apresentadas no Voyage.',
    image: 'front-end/img/noticia_1taquaritinga.png',
    content: `<p>Tem novidade chegando! Taquaritinga (SP) agora está presente na seção de regiões do Voyage.</p>
<p>A ampliação da plataforma é mais um passo para reunir informações e conteúdos sobre cidades da região em um só lugar. Com essa atualização, os visitantes podem encontrar Taquaritinga junto de Matão e Jaboticabal.</p>
<p>Acesse a página Regiões, confira as cidades disponíveis e acompanhe o blog para ficar por dentro das próximas novidades do Voyage.</p>`
  },
  {
    id: 'como-usar-o-voyage',
    title: 'Como usar o Voyage: um guia para começar',
    summary: 'Aprenda a navegar pelo site, consultar regiões e acompanhar o blog.',
    image: 'front-end/img/noticia_comousar.png',
    content: `<p>Está conhecendo o Voyage agora? Começar é simples: abra o site e utilize o menu principal para acessar as áreas disponíveis.</p>
<p><strong>1. Explore as regiões:</strong> entre na página Regiões para conferir as cidades cadastradas. Utilize o campo de pesquisa para encontrar uma cidade específica.</p>
<p><strong>2. Acompanhe o blog:</strong> visite a área Blog para encontrar novidades, conteúdos e orientações. Se uma publicação chamar sua atenção, selecione Ler mais para abrir o conteúdo completo.</p>
<p><strong>3. Confira as atualizações:</strong> novas regiões e publicações poderão ser adicionadas ao longo do tempo.</p>
<p>Pronto! Esse é o caminho inicial para explorar o conteúdo disponível no Voyage.</p>`
  },
  {
    id: 'matao-agora-no-voyage',
    title: 'Matão agora está no Voyage',
    summary: 'Matão faz parte das cidades disponíveis na seção Regiões.',
    image: 'front-end/img/noticia_1matao.png',
    content: `<p>Matão (SP) está entre as cidades cadastradas na seção Regiões do Voyage.</p>
<p>A presença da cidade amplia o conteúdo regional reunido na plataforma e facilita a consulta das localidades disponíveis.</p>
<p>No site, basta acessar a página Regiões e procurar por Matão na lista ou utilizar o campo de pesquisa.</p>
<p>Essa é mais uma etapa do crescimento do Voyage.</p>`
  },
  {
    id: 'conheca-taquaritinga-voyage',
    title: 'Taquaritinga no Voyage: conheça a cidade na plataforma',
    summary: 'Taquaritinga é uma das cidades apresentadas pelo Voyage.',
    image: 'front-end/img/noticia_1taquaritinga.png',
    content: `<p>Taquaritinga (SP) agora integra a lista de regiões do Voyage.</p>
<p>Para encontrá-la, acesse a página Regiões e digite Taquaritinga no campo de pesquisa.</p>
<p>O Voyage segue ampliando sua presença regional e organizando seus conteúdos para tornar a navegação pelo site mais simples.</p>`
  },
  {
    id: 'jaboticabal-chega-voyage',
    title: 'Jaboticabal também chegou ao Voyage',
    summary: 'Jaboticabal é a terceira cidade cadastrada na seção Regiões.',
    image: 'front-end/img/noticia_2.png',
    content: `<p>Jaboticabal (SP) também está no Voyage! A cidade agora aparece na seção Regiões, ao lado de Matão e Taquaritinga.</p>
<p>Para consultar a cidade, abra a página Regiões e procure por Jaboticabal. O campo de pesquisa ajuda a encontrar rapidamente uma localidade.</p>
<p>Essa atualização reforça o objetivo do projeto de reunir cidades e conteúdos regionais em uma experiência digital simples e acessível.</p>`
  },
  {
    id: 'tres-cidades-uma-plataforma',
    title: 'Três cidades, uma plataforma: conheça as regiões do Voyage',
    summary: 'Matão, Taquaritinga e Jaboticabal já estão reunidas no Voyage.',
    image: 'front-end/img/noticia_3.png',
    content: `<p>O Voyage está reunindo suas primeiras cidades em um só lugar. Matão, Taquaritinga e Jaboticabal já podem ser encontradas na seção Regiões do site.</p>
<p>A proposta é facilitar a consulta das localidades que fazem parte do projeto e manter o conteúdo organizado.</p>
<p>Este é o começo de uma jornada de expansão. Acompanhe o blog para conhecer as atualizações e os próximos conteúdos publicados pela equipe.</p>`
  },
  {
    id: 'blog-voyage-novidades-regiao',
    title: 'Blog Voyage: acompanhe as novidades e descubra a região',
    summary: 'Conheça o espaço de novidades, orientações e conteúdos do Voyage.',
    image: 'front-end/img/noticia_4.png',
    content: `<p>O blog é o espaço do Voyage dedicado a compartilhar novidades do projeto e conteúdos para quem deseja conhecer melhor a plataforma.</p>
<p>Por aqui, você encontra comunicados sobre a chegada de novas cidades, orientações para navegar pelo site e publicações relacionadas às regiões cadastradas.</p>
<p>Confira os artigos e volte sempre para acompanhar as próximas publicações. O Voyage está em construção e novas atualizações poderão aparecer por aqui.</p>`
  }
];

async function cadastrarNoticias() {
  for (const n of noticias) {
    await pool.query(
      `INSERT INTO news
       (id, title, author, summary, content, image)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       author = EXCLUDED.author,
       summary = EXCLUDED.summary,
       content = EXCLUDED.content,
       image = EXCLUDED.image`,
      [
        n.id,
        n.title,
        'Equipe Voyage',
        n.summary,
        n.content,
        n.image
      ]
    );
  }

  const result = await pool.query(
    `SELECT id, title FROM news
     WHERE id = ANY($1::varchar[])
     ORDER BY title`,
    [noticias.map(n => n.id)]
  );

  console.log('Publicações cadastradas:');
  console.table(result.rows);
}

cadastrarNoticias()
  .catch(error => {
    console.error('Erro:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
