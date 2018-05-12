---
layout: post
title:  "Buenas prácticas en NodeJS"
date:   2018-05-07 16:27:19 +0200
---
Como decía recientemente, en Audiense llevamos unos 6 años construyendo nuestra aplicación de backend en NodeJS. Por aquel entonces el lenguaje todavía no estaba muy maduro, o mejor dicho, la comunidad y todo el ecosistema todavía no estaba lo suficientemente maduro para crear un proyecto serio. Sin embargo Alfredo, el CTO, se lanzó de cabeza a usarlo porque era el lenguaje que menos barrera de entrada le suponía y, además, estaba muy de moda y podría atraer a gente buena que le interesase un cambio.

Fue un camino de aprendizaje a base de golpes, cuando no fallaba el código que habías creado por alguna callback no gestionada correctamente, fallaba la implementación de un driver o alguna librería (que recuerdos usando las primeras versiones de Kue).

Por suerte eso ya hace tiempo que quedó atrás y hoy en día el ecosistema ha crecido y madurado para que no tengas que preocuparte de ese tipo de cosas y puedas poner todo tu esfuerzo en desarrollar tu código lo mejor posible.

Y sobre esto va esta serie de artículos. Seguramente hayas visto un montón de ejemplos de cómo crear una API rápidamente con Express, o sobre cómo persistir información en MongoDB con mongoose, o de como hacer una aplicación de chat basada en sockets. Aquí lo que veremos es una serie de prácticas para crear aplicaciones en NodeJS más fáciles de entender y mantener, desacopladas de la infraestructura y fáciles de testear.
