# Portafolio Web · Antonio Canux

Portafolio personal de **Marco Antonio Canux Raquec**, Técnico en Desarrollo de Software. Es un portafolio inmersivo que se recorre con el scroll: cuenta mi paso de la mecánica automotriz al desarrollo de software con un motor 3D que se despieza, se vuelve plano técnico y termina convertido en código.

**Vista previa:** https://canuxantonio502.github.io/portafolio_profesional/

## El recorrido

1. **Inicio:** presentación con el nombre que entra letra por letra y contadores con datos reales.
2. **Sobre mí · Del motor al código:** un manifiesto que se ilumina palabra por palabra y da paso a la trayectoria en cuatro capítulos. Un motor V8 en 3D acompaña cada capítulo: gira armado, se despieza, se convierte en aristas de plano técnico y se transforma en una ventana de código.
3. **Habilidades:** carrusel continuo de logos; al pasar el mouse aparece una tarjeta con el nombre y su uso.
4. **Proyectos:** galería horizontal fijada. Al bajar, las tarjetas pasan de lado; los filtros siguen funcionando.
5. **Contacto · La meta:** el motor vuelve a armarse al llegar al final, con el formulario y las redes.

Durante todo el recorrido, un **tacómetro 3D** en la esquina indica el avance: la aguja sube con el scroll y la zona roja se enciende al llegar a la meta.

## Proyectos incluidos

| Proyecto | Tipo | Tecnologías |
| --- | --- | --- |
| [WTWT · What to Watch Today](https://github.com/lucaspajarito01/wtwt_movie_explorer_backend) | Full stack (en equipo) | Node.js, Express, MySQL, JWT, Swagger |
| [AlwayStrong · Gestión de gimnasio](https://github.com/canuxantonio502/alwaysstrong_nodejs_campuslands) | Aplicación CLI | Node.js, MySQL, Inquirer, SOLID |
| [Gestión de CampusParking](https://github.com/canuxantonio502/gestion_parqueo_javascript) | Aplicación web | HTML, CSS, JavaScript |
| [Campus Movie Explorer](https://github.com/canuxantonio502/campus_movie_explorer) | Aplicación web | HTML, CSS, JavaScript, TMDB API |
| [Página para festival de música](https://canuxantonio502.github.io/festival_html_css/) | Sitio web | HTML, CSS |
| Portafolio profesional | Sitio web | HTML, CSS, JavaScript, Three.js, GSAP |

## Tecnologías utilizadas

- HTML5 y CSS3 (variables, máscaras, `backdrop-filter`, diseño responsivo)
- JavaScript sin frameworks
- [Three.js](https://threejs.org/) para los modelos 3D (glTF comprimidos con meshopt)
- [GSAP](https://gsap.com/) y ScrollTrigger para las animaciones ligadas al scroll
- [Lenis](https://lenis.darkroom.engineering/) para el scroll suave
- Git y GitHub Pages

## Características

- Experiencia inmersiva guiada por el scroll, con modelos 3D reales.
- Diseño responsivo, con tema claro y oscuro.
- Sitio bilingüe (español / inglés) con selector en el encabezado; recuerda el idioma elegido.
- Visor de CV integrado con opción de descarga.
- Formulario de contacto con validación que envía el mensaje por WhatsApp.
- **Accesible y con respaldos:**
  - Con "reducir movimiento" activado, cada sección muestra un estado fijo, sin animaciones de scroll.
  - Sin WebGL o con ahorro de datos se usan ilustraciones SVG en lugar de los modelos 3D.
  - Los modelos se cargan solo cuando su sección se acerca.

## Estructura del proyecto

```
portafolio_profesional/
├── index.html        # Estructura de la página
├── css/
│   ├── styles.css    # Estilos, temas y animaciones
│   └── *.png/jpg/svg # Imágenes, íconos y capturas de proyectos
├── js/
│   ├── i18n.js       # Textos en español e inglés
│   ├── main.js       # Tema, idioma, scroll, animaciones, filtros, formulario y visor de CV
│   ├── engine3d.js   # Motor 3D de la trayectoria y de la meta
│   └── tach3d.js     # Tacómetro 3D
├── models/           # Modelos 3D comprimidos (.glb) y sus licencias
└── cv/               # CV en PDF (español e inglés)
```

## Créditos de los modelos 3D

Ambos modelos se usan bajo licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) y fueron comprimidos para la web:

- ["Animated Engine V8"](https://sketchfab.com/3d-models/animated-engine-v8-b0dbf778b81e4afba4edf11336e2a099) de [meeww](https://sketchfab.com/meeww).
- ["Original car self-illuminating meter"](https://sketchfab.com/3d-models/original-car-self-illuminating-meter-4c9efe86824745f79eab8e2135a561a0) de [celsko683mywork](https://sketchfab.com/celsko683mywork).

## Objetivo del proyecto

Contar con una página web profesional que sirva como carta de presentación en el área de desarrollo de software y que muestre los conocimientos adquiridos hasta el momento.

## Autor

**Antonio Canux** · Único colaborador · [canuxantonio502](https://github.com/canuxantonio502)
