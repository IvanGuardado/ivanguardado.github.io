---
layout: post-guia
title:  Guía de buenas prácticas en NodeJS
date:   2018-06-08 19:16:49 +0100
permalink: /posts/2018-06-08/guia-buenas-practicas-nodejs.html
categories: nodejs, code
---
En Audiense llevamos unos 6 años construyendo nuestra aplicación de backend en NodeJS. Por aquel entonces esta novedosa plataforma para correr JS de lado del servidor estaba en auge y la gente se tiraba de cabeza a crear sus proyectos (o incluso a migrar los existentes) en ella aún sin saber si escalaría bien a proyectos grandes.

Siendo sinceros, en aquel momento no sabíamos muy bien lo que hacíamos. NodeJS tiene particularidades con la ejecución asíncrona que si no conoces puedes acabar con una aplicación llena de leaks que se acaba bloqueando y nadie sabe la razón. Además, al ser JavaScript un lenguaje de programación sin tipos y sin una estructura fija que obligue a seguir ciertas buenas prácticas por defecto, nuestra base de código se convirtió rápidamente en un gran monolito acoplado difícil de mantener. ¿Te suena familiar esta situación?

Las alarmas saltaron en aquel momento y gracias a la incorporación de nuevos desarrolladores con más experiencia en el tema, como [David Rey](https://twitter.com/dreyacosta), comenzamos poco a poco a aplicar buenas prácticas de arquitectura de código en nuestra aplicación NodeJS.

En esta guía mi intención es mostraros esas buenas prácticas que han hecho que nuestro código sea más **flexible**, más fácil de **entender** y de **testear**.
