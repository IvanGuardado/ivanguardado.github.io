---
layout: post
title: "Parte III: Tests automáticos"
permalink: /posts/2018-06-08/arquitectura-codigo-nodejs/parte-iii-tests-automaticos.html
description: En esta tercera parte veremos como aplicar diferentes técnicas de testing en NodeJS.
date: 2018-06-08 19:16:49 +0100
categories: [NodeJS]
tags: [NodeJS, Code, Good practices, TDD]
image: assets/images/arquitectura-codigo-nodejs.png
pagination: 
    enabled: false
---

Una parte imprescindible en el desarrollo de software es la automatización de pruebas sobre el código. De nuevo, esta guía no pretende ser un tutorial sobre testing sino mostrar algunas técnicas para llevarlo a cabo en NodeJS, teniendo en cuenta las prácticas de desarrollo de código vistas anteriormente.

## Test unitarios
Los tests unitarios se encargan de probar una pieza de lógica de nuestro código. Básicamente se trata de coger un componente, extraerlo del sistema y de forma aislada **ver como responde a distintos escenarios**. Llevándolo al mundo real, es como si de un coche sacamos el amortiguador y lo metemos en una máquina que le aplica distintos tipos de vibraciones para comprobar que funciona correctamente. Esto no nos garantiza que que el coche entero funcione, ni siquiera nos garantiza que el amortiguador vaya a ser conectado en el lugar correcto, pero sí podemos asegurar que se comporta de manera esperada de forma aislada.

¿Cómo se traduce esto en el mundo del software? ¿Cómo separamos al componente del resto del sistema? En realidad si utilizas la inyección de dependencias correctamente tus componentes ya están desacoplados y se pueden usar de forma aislada.

### Test dobles
Al igual que en el cine existe la figura del doble, que se hace pasar por un actor real, en los tests unitarios existen los dobles que se hacen pasar por dependendencias reales. Dependiendo del tipo de trabajo que hacen reciben distintos nombres: *spy*, *stub*, *mock*… En los tests unitarios lo normal es usar *stubs*, que viene a ser crear la dependencia con un comportamiento predefinido para comprobar cómo se comporta el componente que estamos testeando.

En OOP lo normal para crear un stub es crear una clase que extienda de la dependencia original y sobreescribir los métodos necesarios para crear un escenario controlado.

En JS vamos a buscar una solución más sencilla falseando parcialmente el código de las dependencias que sabemos que se va a usar.

```js
// Creamos un doble para userRepository.
// No necesitamos definir todas las funciones si sabemos que no se usan.
const fakeRepository = {
 findById: (id) => {
   return { id, name: 'Ana', age: 28 }
 }
}

// Creamos el servicio con el doble inyectado, de forma que sabemos
// que siempre va a encontrar un usuario.
const myService = serviceBuilder({ userRepository: fakeRepository })
myService(userId)
```

```js
// Ejemplo para comprobar que el servicio se comporta bien cuando
// no se encuentra ningún usuario.
const fakeRepository = {
   findById: (id) => {
       return null
   }
}
const myService = serviceBuilder({ userRepository: fakeRepository })
myService(userId)
```

Si cambiamos la interfaz de nuestra dependencia lo más probable es que falle el test ya que el servicio estará llamando a una función inexistente o con los parámetros erróneos.

Una buena opción para crear cualquier tipo de test doble es usar [SinonJS](http://sinonjs.org/), pero ten en cuenta que si tenemos que recurrir a dobles muy complejos probablemente el código pueda ser refactorizado para que sea más sencillo.

## Tests de integración
Como en el ejemplo del amortiguador, tener una buena batería de tests unitarios no nos asegura que el sistema funcione correctamente como un todo, y menos en el caso de lenguajes sin tipos donde no existe un comprobador de tipos que garantice que todo está bien conectado.

Por eso también es importante crear tests de integración. A diferencia de los tests unitarios, aquí ya no tenemos que falsear las dependencias (salvo algunas excepciones que veremos más adelante) porque justamente lo que se quiere es **comprobar que las dependencias están correctamente inyectadas**.

¿Se puede acceder a las bases de datos? ¿Simulamos peticiones HTTP para comprobar que la API funciona bien? ¿Se accede a colas de mensajes? ¿Se permite interactuar con servicios externos?

Estas son algunas preguntas que surgen cuando hablamos de test de integración y personalmente creo que cada organización debe establecer sus límites. Yo aconsejo no estirar demasiado este límite ya que sino acabaremos entrando en el terreno de los tests punto a punto (end to end). Estas son las normas que tenemos en Audiense para los tests de integración:

**Se permite**
- Acceder a bases de datos MySQL, Mongo, Redis.

**No se permite**
- Acceder a colas de mensajes
- Llamar a servicios externos (APIs, Cloud...)
- Acceder a servicios de difícil configuración para testing como SOLR

Para nosotros lo más normal es crear tests de integración para las acciones (recuerda, casos de uso) para asegurarnos de que todo el flujo se completa completamente. Sin embargo hay que tener cuidado de cumplir con las restricciones anteriores.

### Nock
Esta es [una librería](https://github.com/node-nock/nock) que nos permite interceptar todas las salidas HTTP de nuestros tests y guardar la respuestas para reproducirlas en las siguientes ejecuciones. De esta forma conseguimos que nuestros tests vayan mucho más rápido (no se hacen realmente las llamadas HTTP) y además nos aseguramos que sean deterministas, es decir, no dependemos del estado del servicio externo para que podamos asegurar que nuestro código funciona.

Hay que tener en cuenta que con esto no intentamos detectar cuando el servicio exterior cambia de interfaz. Simplemente queremos validar nuestro código **para una versión conocida de este**. En caso de cambios en la API, habría que volver a grabar los resultados de las peticiones.

### Proxyquire
Esta es [otra librería](https://github.com/thlorenz/proxyquire) que nos puede ayudar a que no nos saltemos las reglas en nuestros tests de integración. Como decía, aquí no deberíamos falsear las dependencias, ya que justamente lo que necesitamos es asegurar que todo está bien conectado. Sin embargo a veces sí podríamos necesitar que algún componente tenga un comportamiento falso para asegurar el determinismo del test o simplemente porque en el flujo se accede a un servicio que queremos excluir.

Siguiendo la arquitectura de código propuesta en esta guía, proxyquire debería apuntar siempre a un fichero constructor (index.js), que es donde se hace uso de `require`. Supongamos que construímos una acción que tiene una dependencia con un servicio de infraestructura que queremos excluir por el motivo que sea.

```js
// src/actions/index.js
const PubSub = require('../infrastructure/pubsub')
const usersRepository = require('../infrastructure/usersRepository')
const createNewUser = require('./createNewUser')({ PubSub, usersRepository })

module.exports = {
   createNewUser
}
```

Así es como lo haríamos con la ayuda de proxyquire:

```js
const proxyquire = require('proxyquire')

const actions = proxyquire('../src/actions', {
 '../infrastructure/pubsub': createFakePubSub()
})

const createNewUser = actions.createNewUser;
```

En este ejemplo desactivamos el comportamiento de `PubSub`, sin embargo el resto de dependencias continuarán haciendo su trabajo.

Proxyquire también es muy útil cuando tenemos que trabajar con **código legado** que no permite la inyección de dependencias. Teniendo en cuenta que la mayor parte de nuestro trabajo es lidiar y mejorar este tipo de código vale la pena echarle un ojo y tenerla bajo el radar.

### Data Builders
En la mayoría de proyectos necesitaremos tener un conjunto de datos para asegurarnos de que el código funciona correctamente. Para esto lo mejor es implementar una herramienta que nos permita generar datos, sea en memoria o en DB de forma que no tenemos que lidiar constantemente con ello en los tests.

Para ayudarnos con esto existen diversas librerías como [faker.js](https://github.com/Marak/Faker.js) que generan datos de forma aleatoria. Sobre esto podemos construir nuestras propias funciones *helper* para crear una API sencilla que podamos usar en nuestros tests de integración y nos ayude tanto a **crear como a limpiar los datos**.

Este es un ejemplo de lo que hemos hecho en Audiense, aunque la implementación es demasiado personalizada como para poder compartir el código. Analiza cuáles son las necesidades de generación de datos en tu proyecto e intenta crear una capa de abstracción para poder reusarlo y cambiarlo en cualquier momento.

```js
// Inserta 100 cuentas de usuario aleatorias
var builder = accountDataBuilder()
builder.insert(100)
// Limpia los datos
builder.clean()
```

```js
// Inserta 100 cuentas de usuario con el mismo codigo postal
accountDataBuilder()
 .withZipAddress(12345)
 .insert(100)
```

```js
// Obtiene una instancia para una cuenta en concreto
const user = accountDataBuilder()
 .withId(1)
 .withName('Ana')
 .withEmail('ana@foo.com')
 .build()
```

## Spec Helpers
Independientemente de que sean tests unitarios o de integración, uno de las mayores fricciones que teníamos a la hora de escribir tests era lidiar con las rutas de los ficheros de código que queríamos probar. Teníamos cosas como esta:

```js
const checkStatus =
 require('../../../../../../core/domain/news').service.checkStatus
```

Aunque editores como VS Code te ayudan con el auto completado de directorios, está claro que no es algo elegante. Uno de los problemas de esto es que acoplas los tests a la organización de directorios de tu código.

La solución la trajo [Gabriel](https://twitter.com/gramos74) del mundo de Ruby. Lo que hicimos fue crear un fichero llamado `spec_helpers.js` que define funciones de ayuda que estarán disponibles *automágicamente* en todos los tests. La forma de lograr esto es a través del argumento `--require` de mocha, por lo que si usas otro test runner tendrás que ver si existe algo similar.

```
# mocha.opts
--reporter spec
--ui bdd
--require test/spec_helper.js
--bail
```

En este fichero de ayuda, tenemos entre otras, funciones que apuntan directamente a ciertos path del código.

```js
specHelper = {
 rootPath: __dirname + '/../',
 corePath: __dirname + '/../core/',
 actionPath: __dirname + '/../core/actions/',
 domainPath: __dirname + '/../core/domain/',
 infrastructurePath: __dirname + '/../core/infrastructure/',
 libPath: __dirname + '/../lib/',
};

specHelper.actions = domainName => require(`${specHelper.actionPath}${domainName}`);
specHelper.domain = domainName => `${specHelper.domainPath}${domainName}`;
specHelper.lib = libName => require(`${specHelper.libPath}${libName}`);
```

De esta forma, podemos usar estas funciones en nuestros tests para cargar componentes de código de forma mucho más fácil y desacoplada de los directorios.

```js
const checkStatus = specHelper.domain('news').service.checkStatus
```

A partir de entonces comenzamos a añadir otros *helpers* de tareas que detectamos que nos añadían fricción a la hora de escribir tests:
- Funciones para poder integrar nock de forma sencilla en los tests de integración que lo necesiten.
- Funciones para acceder fácilmente a los *data builders* y poder generar datos fácilmente.

Esto es una muestra de cómo una solución tan sencilla puede mejorar la productividad. Muchas veces la simple excusa de no tener muy claro cómo funciona nock o cómo generar datos puede ser suficiente para no hacer determinados tests. 

Encuentra cuales son los puntos de fricción a la hora de escribir tests en tu proyecto, crea funciones que la reduzcan y añadelas al fichero de `spec_helpers.js` para que estén accesibles en todos los tests.

{% include indice.html %}
