---
layout: post
title: "Parte II: Aplicando la teoría"
permalink: /posts/2018-06-08/guia-buenas-practicas-nodejs/parte-ii-aplicando-teoria.html
pagination: 
    enabled: false
---

En la primera parte hemos visto las distintas partes en las que podemos dividir nuestro código y las reglas que tenemos que seguir para que se mantenga desacoplado. Puede que todo suene un poco abstracto y todavía sea difícil hacerse una idea de como aplicar todo esto en nuestras aplicaciones de NodeJS. En esta parte veremos cómo llevar a la práctica todo eso.

## Inyección de dependencias
Vamos a seguir con el ejemplo anterior en el que inyectamos las dependencias directamente en los argumentos de la llamada a la función.

```js
function createUser(userRepository, userValidator, email, password) {
 const user = { email, password }
 userValidator.validate(user)
 userRepository.save(user)
}
```

Como hemos dicho, mezclar las dependencias con los parámetros no es una buena práctica. Vamos a intentar mejorar eso ayudándonos de las *arrow functions* de ES6 y separar las dependencias de los argumentos de la función.

```js
const createUser = (userRepository, userValidator) => (email, password) => {
 const user = { email, password }
 userValidator.validate(user)
 userRepository.save(user)
}
```

Para quien no conozca bien esta forma de definir funciones, sería lo mismo que escribir esto:

```js
function createUser(userRepository, userValidator) {
   return function(email, password) {
       const user = { email, password }
       userValidator.validate(user)
       userRepository.save(user)
   }
}
```

Esto está un poco mejor, por lo menos si seguimos siempre ese patrón, sabemos que createUser en realidad es una función constructora que nos devuelve la función real para crear un usuario. La forma de usarla sería la siguiente.

```js
createUser(userRepository, userValidator)("ana@foo.com", "123")
```

Obviamente tener que pasar las dependencias cada vez que queremos usar la función haría nuestro código un lío total, pero gracias a tener una función constructora, podemos hacer una aplicación parcial para obtener la función que luego usaremos en nuestro código.

```js
const createUserBuilder = (userRepository, userValidator) => (email, pwd) => {
   // ...
}
const createUser = createUserBuilder(userRepository, userValidator)

// Usaremos esto en nuestro código
createUser("ana@foo.com", "123")
```

Gracias a esta técnica podemos crear distintas interpretaciones de la función. Por ejemplo, para testing podemos pasarle un repositorio en memoria o un doble que no haga nada, o si por lo que sea nos encontramos en un momento de migración podríamos tener dos funciones distintas, una usando Mongo y otra MySql.

```js
const createUserFake    = createUserBuilder(fakeUserRepository, userValidator)
const createUserInMysql = createUserBuilder(MySqlUserRepository, userValidator)
const createUserInMongo = createUserBuilder(MongoUserRepository, userValidator)
```

## Módulos constructores
Ahora que ya tenemos la posibilidad de inyectar dependencias y podemos separar la parte de construción (inyección) de la parte de ejecución tenemos que definir una forma estándar de dónde, cuándo y cómo definimos estos constructores en nuestro proyecto.

En Audiense lo hacemos de la siguiente manera, y la verdad que nos funciona muy bien ya que el código se queda limpio y fácil de usar:

- Todos los módulos con dependencias exponen una función constructora. Por lo que el uso de `require` en el código de dominio es practicamente inexistente (algunas excepciones que permitimos son dependencias como `async` o `lodash`)
- Las construcciones se hacen en los ficheros índice (index.js). Aquí es donde estarán todos los `require` y se puede ver de forma explícita las dependencias de todos los módulos en ese directorio. Es un buen lugar donde comenzar a buscar duplicidades o patrones para abstraer.

**Ejemplo de dos acciones y su fichero constructor**

```js
// actions/createUser.js
module.exports = ({ userRepository, userValidator }) => (email, pwd) => {
   // ...
}
```

```js
// actions/removeUser.js
module.exports = ({ userRepository }) => (userIdToRemove) => {
   // ...
}
```

```js
// actions/index.js
// En el directorio repository también tendríamos un index.js para construír userRepository
const userRepository = require('./infrastructure/repository').userRepository

// Exponemos las funciones construidas
module.exports = {
   createUser: require('./createUser')({ userRepository, userValidator }),
   removeUser: require('./removeUser')({ userRepository })
};
```

Una vez tenemos nuestras acciones de la aplicación ya construidas y expuestas en el fichero de índice, ya solo nos queda requerir ese fichero donde queramos usarlas desde nuestro framework.

```js
const { createUser } = require('../app/actions');

app.post('/create-user', (req, res) => {
   createUser(req.body.email, req.body.password)
})
```

Como se puede ver, el uso final es super sencillo y no vemos nada de dependencias. Simplemente importamos la función y la usamos. Sin embargo, si queremos hacer tests unitarios de la acción, podemos importar directamente el módulo y falsear las dependencias para tener control de los distintos escenarios.

```js
const createAccountBuilder = require('../app/actions/createUser')

describe('Create a new account', () => {
   it('should return an error if the email already exists', () => {
       const userRepositoryStub = createUserRepositoryStub()
       const userValidatorStub = createUserValidatorStub()

       const createAccount = createAccountBuilder({ userRepositoryStub,
           userValidatorStub
       })

       createAccount('email@audiense.com', 'mypass')
      
       // assertion here
   })
})
```

## Patrones de diseño
Cuando se habla sobre arquitectura de código, siempre se suele recurrir a ciertos patrones de diseño de forma que el propio código nos ayude a seguir el estándar que definamos y que todo encaje a la perfección. Por ejemplo, podríamos decidir que todas las acciones de la aplicación fuesen clases que implementen una interfaz `Action` de forma que todas tengan un método llamado `execute`.

Está bien hacerlo si el lenguaje en el que trabajas te lo permite, sin embargo, JavaScript es un lenguaje de programación sin tipos y muy sencillo (cada vez menos). Esto tiene su partes buenas y malas. La parte mala es que no vamos a poder aplicar estos patrones de diseño fácilmente, por lo que considero un error hacer hacks con el lenguaje para intentar simular este tipo de cosas. En lugar de esto, vamos a aprovechar su sencillez para **crear una arquitectura sencilla**.

Cuando no podemos definir las reglas de arquitectura en el propio código usando patrones de diseño, tenemos que hacer que sean los propios programadores los que conozcan las reglas y las apliquen, y para esto nada mejor que tener algo sencillo.

En la primera parte decíamos que las dependencias de infraestructura deberían ser inyectadas en nuestro código de dominio, de forma que este define una interfaz y el código desde fuera se adapta a ella. Pero ¿cómo hacemos esto si no tenemos interfaces en JavaScript? La primera solución es **sentido común**. Si controlas ambas partes del código tienes que tener la prudencia de no cambiar la interfaz, o en caso de hacerlo saber a qué partes puede estar afectando. Sin embargo puede haber otras soluciones más o menos complejas para intentar evitar este tipo de escenarios. La más sencilla y natural es con tests de código.

## Objetos vs. Clases vs. Funciones
Aunque últimamente la programación funcional está comenzando a tener más relevancia gracias a lenguajes como Scala, Swift o Kotlin, la mayoría de nosotros hemos sido programados para pensar en OOP (Object Oriented Programming). En mi opinión esto ha sido debido a la gran influencia de Java en el sector en las últimas décadas. La gente de Sun hizo muchas cosas bien y revolucionó la forma de crear software. Esta revolución grabó en la cabeza de todos que la OOP era la forma idónea de modelar el software hasta el punto de que tanto los nuevos lenguajes de programación como los ya existentes lo incluyeron. Esto también hizo que fuese el estándar a enseñar en las universidades.

Desde mi punto de vista, OOP no tiene nada de malo y está demostrado que funciona bien. Igual de bien como puede funcionar la programación funcional. Al final todo se reduce al conocimiento que se tenga sobre la técnica y no a la técnica en sí. Lo que no estoy tan de acuerdo es intentar simular la programación OOP que vemos en Java en lenguajes mucho más simples como JavaScript.

Como hemos dicho, buscaremos una solución sencilla en lugar de complicarnos a buscar clases, herencia y polimorfismo en **un lenguaje que no está diseñado para eso**. ¿Deberíamos modelar todo como objetos siguiendo el legado de Java? En Audiense creemos que no. A continuación listamos las reglas para elegir si usar clases, objetos (*singleton*) o funciones.

### Acciones
Un caso de uso de la aplicación está representado como una acción en nuestro código. Las acciones son verbos (*crear* usuario, *cambiar* contraseña, *borrar* ítem de contenido...) por lo tanto las definimos como funciones. Esto quiere decir que todos los punto de entrada a nuestra lógica de dominio son funciones. ¿Hay algo más sencillo que eso?

En algunos patrones verás como a veces se crea una interfaz que tienen que implementar todos los servicios de aplicación, obligando por tanto a que sean clases. Pero sinceramente, en este contexto, no le vemos sentido a hacerlo.

```js
// Función: Sencilla y directa
// createUser(email, pwd)
module.exports = (deps) = (email, pwd) => {
 // ...
}
```

```js
// Clase: demasiada complejidad innecesaria
// const createUserHandler = new CreateUserHandler()
// createUser.handle(email, pwd)
module.exports = (deps) = function CreateUserHandler() {
 this.handle = function(email, pwd) {
   // ...
 }
}
```

```js
// Objeto: sigue teniendo complejidad innecesaria
// createUser.handle(email, pwd)
module.exports = (deps) = {
 handle: (params) => {
   // ...
 }
}
```

Ojo, si vas a conectar tus casos de uso con algún framework de forma que se llaman de forma automatizada sí deberías pensar en usar algún patrón para tener algo estándar. En nuestro caso llamamos a las acciones de forma ad-hoc, ya sea desde los controladores de Express, desde un script o desde un worker.

### Servicios de domino
Aquí podremos encontrar tanto objetos con varias funciones relacionadas, como funciones. Por ejemplo si creamos un servicio para calcular las comisiones de una transacción, probablemente pueda ser directamente una función. Sin embargo si tuviésemos distintos cálculos relacionados con comisiones, podríamos tener un objeto que que las agrupe.

```js
module.exports = (deps) = {
 calculateForEmisor: () => {
   // ...
 },
 calculateForReceiver: () => {
   // ...
 }
}
```

### Objetos de dominio
Aquí ya nos solemos mover con datos, y la mejor forma de encapsular los datos junto con operaciones sobre ellos es el uso de clases. Entidades, agregados, DTOs… son típicos ejemplos donde el uso de clases sí nos aporta valor.

```js
function User(id, name) {
 this.id = id
 this.name = name

 this.isAnonymous = function() {
   return !this.name
 }
}
```

Si tenemos diversas formas de estructurar nuestro modelo, **¿por qué generalizar y decir que todo deben ser objetos?** Elige la que mejor se adapte para cada caso y no olvides que el desarrollo de software es iterativo. Algo que comienza como una función podría acabar convirtiéndose en una clase si por la razón que sea tiene que guardar un estado. Mantente atento para evitar que un código sencillo se acabe convirtiendo en una maraña de funciones sin sentido.

{% include indice.html %}
