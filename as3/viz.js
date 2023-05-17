
import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import SimulatorCPU from './simCPU.js'
import { indexArray, sampleUniform, randomInt, loadJSON} from './utils.js'

let renderer, scene, camera, stats, controls;
let particles, geometry;
let params, method, simulator;
let nowTime, prevTime, timestep;



method = "runge-kutta"

loadJSON("params/default.json").then((obj) => {

  params = obj

  init();
  prevTime = Date.now()
  animate();

})



function setCurrentParticles(simulator, geometry, dt) {
    // retrieves current particle positions from simulator and updates geometry

    const particles = simulator.update(dt)

    const positions = [];
    const colors = [];
    const sizes = [];

    const color = new THREE.Color();

    for (let i = 0; i < particles.length; i++) {
        let p = particles[i]

        positions.push( p.pos.x )
        positions.push( p.pos.y )
        positions.push( p.pos.z )

        color.setHSL( i / particles.length, 1.0, 0.6 );
        colors.push( color.r, color.g, color.b );

        sizes.push( p.mass*10 );
    }

    geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
    geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
    geometry.setAttribute( 'size', new THREE.Float32BufferAttribute( sizes, 1 ).setUsage( THREE.DynamicDrawUsage ) );    

}



function init() {


    // SCENE AND CAMERA

    camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 10000 );
    camera.position.z = 70;

    // INIT SCENE

    initScene()

    // RENDERER

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );


    // DOM SETUP

    const container = document.getElementById( 'container' );
    container.appendChild( renderer.domElement );

    stats = new Stats();
    container.appendChild( stats.dom );

    window.addEventListener( 'resize', onWindowResize );


    controls = new OrbitControls( camera, renderer.domElement );
    controls.target.set( 0, 0, 0 );
    controls.update();
    controls.enablePan = false;
    controls.enableDamping = true;


    const uploadEl = document.getElementById( 'upload' );
    uploadEl.addEventListener('change', (event) => {

      const file = event.target.files[0]
      const reader = new FileReader()
      reader.readAsText(file)

      reader.onloadend = (e) => {

        params = JSON.parse(reader.result)
        initScene();
        prevTime = Date.now()

      }
    })

    const demosEl = document.getElementById( 'demos' )
    demosEl.addEventListener('change', (event) => {

      let path = "./params/" + demosEl.value
      loadJSON(path).then((obj) => {
        params = obj
        initScene()
        prevTime = Date.now()
      })

    })

}

function initScene() {

    // INIT PARTICLE SYSTEM SIMULATOR

    simulator = new SimulatorCPU(params, "rk")

    scene = new THREE.Scene();

    // PARTICLE OBJECTS

    const uniforms = {
        pointTexture: { value: new THREE.TextureLoader().load( 'assets/spark1.png' ) }
    };

    const shaderMaterial = new THREE.ShaderMaterial( {
        uniforms: uniforms,
        vertexShader: document.getElementById( 'vertexshader' ).textContent,
        fragmentShader: document.getElementById( 'fragmentshader' ).textContent,

        blending: THREE.AdditiveBlending,
        depthTest: false,
        transparent: true,
        vertexColors: true
    } );
    
    if (particles) scene.remove(particles)
    
    geometry = new THREE.BufferGeometry();

    setCurrentParticles(simulator, geometry, 0)

    particles = new THREE.Points( geometry, shaderMaterial );

    scene.add( particles );


    // VISUAL EMITTER AND COLLIDER OBJECTS

    for (let em of simulator.emitters)
      scene.add(em.getObject())

    for (let col of simulator.colliders)
      scene.add(col.getObject())

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

    requestAnimationFrame( animate );

    nowTime = Date.now()
    if (prevTime == nowTime)
        return
    timestep = nowTime - prevTime
    prevTime = nowTime

    controls.update()
    render();
    stats.update();

}

function render() {

    setCurrentParticles(simulator, geometry, timestep/1000)

    let t0 = Date.now()

    renderer.render(scene, camera);

    let t1 = Date.now()
    //console.log("render", (t1-t0))


}