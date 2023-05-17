import * as THREE from 'three'

import { indexArray, sampleUniform, randomInt, perpendicularVector } from './utils.js'
import { eulerStep, rungeKuttaStep} from './utils.js'

class Emitter {

    constructor(params, massTypes, lifetimeTypes){
        this.particles = params["particles"] // possible particle types
        this.massTypes = massTypes
        this.lifetimeTypes = lifetimeTypes

        this.rate = params["rate"] // expected spawn rate
        this.limit = params["limit"] // max existing particles at once
        this.velRange = params["velocity"] // emitted velocity range

        this.particleCount = 0

        this.initParams(params["parameters"])
    }

    initParams(){
        // to be implemented by subclasses
    }

    sampleEmitted(dt){
        // sample number of emitted particles this time step

        let t = 0
        let k = 0

        while (true){
            let delta = -(1 / this.rate) * Math.log(1 - Math.random())
            if (t + delta > dt) break
            t += delta
            k ++
        }

        return k
    }

    emit(){
        // determine a particle's position and velocity
    }

}

class EmitterPoint extends Emitter {

    initParams(params){
        this.pos = new THREE.Vector3().fromArray(params["position"])
        this.pos = new THREE.Vector3(0, 0, 0)
    }

    emit(){
        let vel = sampleUniform(this.velRange)
        let polar = Math.random() * Math.PI * 2
        let azimuth = Math.random() * Math.PI * 2

        let velVec = new THREE.Vector3(vel, 0, 0)
        velVec = velVec.applyAxisAngle(new THREE.Vector3(0, 0, 1), polar)
        velVec = velVec.applyAxisAngle(new THREE.Vector3(0, 1, 0), azimuth)

        let type = this.particles[randomInt(0, this.particles.length)]
        let mass = sampleUniform(this.massTypes[type])
        let lifetime = sampleUniform(this.lifetimeTypes[type])

        let particle = new Particle(this.pos, velVec, mass, lifetime, this)

        return particle
    }

    getObject() {
        const map = new THREE.TextureLoader().load( "assets/starwhite.png" );
        const material = new THREE.SpriteMaterial( { map: map } );
        const obj = new THREE.Sprite( material );
        obj.scale.copy(new THREE.Vector3(1, 1, 1))
        obj.position.copy(this.pos)
        return obj
    }

}

class EmitterDisk extends Emitter {

    initParams(params){
        this.pos = new THREE.Vector3().fromArray(params["position"])
        this.dir = new THREE.Vector3().fromArray(params["direction"])
        this.rad = params["radius"]
    }

    emit(){
        let vel = sampleUniform(this.velRange)
        let r = Math.random() * this.rad
        let ang = Math.random() * Math.PI * 2
        let posOnDisk = [Math.cos(ang)*r, Math.sin(ang)*r]

        let planeVecA = perpendicularVector(this.dir).normalize()
        let planeVecB = planeVecA.clone().applyAxisAngle(this.dir, Math.PI/2)
        let pos = this.pos.clone().addScaledVector(planeVecA, posOnDisk[0]).addScaledVector(planeVecB, posOnDisk[1])
        let velVec = this.dir.clone().multiplyScalar(vel)

        let type = this.particles[randomInt(0, this.particles.length)]
        let mass = sampleUniform(this.massTypes[type])
        let lifetime = sampleUniform(this.lifetimeTypes[type])

        let particle = new Particle(pos, velVec, mass, lifetime, this)
        return particle
    }

    getObject() {
        const map = new THREE.TextureLoader().load( "assets/lampwhite.png" );
        const material = new THREE.SpriteMaterial( { map: map } );
        const obj = new THREE.Sprite( material );
        obj.scale.copy(new THREE.Vector3(1, 1, 1))
        obj.position.copy(this.pos)
        return obj
    }

}


class Force {

    computeForce(pos, vel, mass){
        // compute force for particle: to be impl. by subclasses
    }

}

class ForceConstant extends Force {

    constructor(c) {
        super()
        this.c = c
    }

    computeForce(pos, vel, mass){
        return this.c
    }

}

class ForceGravity extends Force {

    constructor(g) {
        super()
        this.g = g // acceleration vector
    }

    computeForce(pos, vel, mass) {
        //TBA: return m*g
        let force = this.g.multiplyScalar(mass)
        return force
    }

}

class ForceDrag extends Force {

    constructor(vf, b) {
        super()
        this.vf = vf // velocity of medium
        this.b = b // drag coefficient
    }

    computeForce(pos, vel, mass) {
        // TBA: return -b*(vel - vf)

        let diff = vel.clone().sub(this.vf)
        let force = diff.multiplyScalar(-this.b)
        return force
    }

}

class ForceRadial extends Force {

    constructor(xr, s) {
        super()
        this.xr = xr // force origin
        this.s = s // force strength
    }

    computeForce(pos, vel, mass) {
        // TBA: return -s*(pos-xr)/|pos-xr|^3

        let diff = pos.clone().sub(this.xr)
        let force = diff.divideScalar(diff.length() ** 3)
        return force.multiplyScalar(-this.s)
    }

}


class Collider {

    whichSide(pos) {
        // should return -1 or 1 based on the relative position of pos and collider
        return -1
    }

    onCollide(particle) {
        // should return particle after collision
        return particle
    }    

}

class ColliderPlane extends Collider {

    constructor(pos, normal) {
        super()
        this.pos = pos
        this.normal = normal.normalize()
    }

    whichSide(pos) {
        let left = this.normal.clone().dot(pos)
        let right = this.normal.clone().dot(this.pos)
        return Math.sign(left - right)
    }

    onCollide(particle) {
        particle.vel = particle.vel.reflect(this.normal)
        //particle.vel.negate()
        return particle
    }

    getObject() {
        let geometry = new THREE.PlaneGeometry( 30, 30 );
        let material = new THREE.MeshBasicMaterial( {color: 0xffffff, side: THREE.DoubleSide} );
        material.transparent = true
        material.opacity = 0.2
        let plane = new THREE.Mesh( geometry, material );
        plane.lookAt(this.normal)
        plane.position.copy(this.pos)
        return plane
    }

}


class Particle {

    constructor(pos, vel, mass, lifetime, emitter){
        this.pos = pos
        this.vel = vel != null ? vel : 0
        this.mass = mass
        this.lifetime = lifetime
        this.emitter = emitter
    }

}


class SimulatorCPU {

    constructor(params, method){

        if (!method) method = "basic"

        if (method == "euler"){
            this.method = 1
            this.solver = eulerStep
        } 
        else if (method == "rk" || method == "runge-kutta"){
            this.method = 2
            this.solver = rungeKuttaStep
            }
        else
            this.method = 0


        this.massTypes = []
        this.lifetimeTypes = []

        for (let partType of params["particles"]){
            this.massTypes.push(partType["mass"])
            this.lifetimeTypes.push(partType["lifetime"])
        }

        this.emitters = []
        
        if (params["emitters"])
        for (let emitParams of params["emitters"]){
            let type = emitParams["type"]
            let em = null

            let emMassTypes = emitParams["particles"].map((x, i) => this.massTypes[x])
            let emLifetimeTypes = emitParams["particles"].map((x, i) => this.lifetimeTypes[x])


            if (type == "point") em = new EmitterPoint(emitParams, emMassTypes, emLifetimeTypes)
            else if (type == "disk") em = new EmitterDisk(emitParams, emMassTypes, emLifetimeTypes)
            
            this.emitters.push(em)
        }

        this.forces = []

        if (params["forces"])
        for (let forceParams of params["forces"]){
            let type = forceParams["type"]
            let fpr = forceParams["parameters"]
            let fc = null

            if (type == "constant")
                fc = new ForceConstant(new THREE.Vector3().fromArray(fpr["force"]))
            else if (type == "gravity") 
                fc = new ForceGravity(new THREE.Vector3().fromArray(fpr["acceleration"]))
            else if (type == "drag") 
                fc = new ForceDrag(new THREE.Vector3().fromArray(fpr["wind"]), fpr["drag"])
            else if (type == "radial") 
                fc = new ForceRadial(new THREE.Vector3().fromArray(fpr["position"]), fpr["strength"])

            this.forces.push(fc)
        }

        this.colliders = []

        if (params["colliders"])
        for (let colParams of params["colliders"]){
            let type = colParams["type"]
            let cpr = colParams["parameters"]
            let col = null
            
            if (type == "plane")
                col = new ColliderPlane(new THREE.Vector3().fromArray(cpr["position"]),
                        new THREE.Vector3().fromArray(cpr["normal"]))
            
            this.colliders.push(col)
        }


        this.particles = []

    }

    // EMISSIONS SAMPLING (TODO: consider moving to different class)

    computeEmissions(particles, emitters, dt){
        
        for (let i in particles){
            let par = particles[i]
            par.lifetime -= dt
            if (par.lifetime < 0)
                par.emitter.particleCount --
        }
        particles = particles.filter((par) => par.lifetime > 0)

        for (let emitter of emitters){
            let emittedTypes = emitter.sampleEmitted(dt)
            //let numEmitted = emitter.rate // TBA: POSSION SAMPLING
            let numEmitted = emitter.sampleEmitted(dt)
            let numAllowed = Math.min(emitter.limit - emitter.particleCount, numEmitted)
            emitter.particleCount += numAllowed

            for (let i = 0; i < numAllowed; i++){
                // let pos, vel, mass, life, thisEmitter
                // mass = this.massTypes[emittedTypes[i]]
                // life = this.lifetimeTypes[emittedTypes[i]]
                // thisEmitter = emitter
                // [pos, vel] = emitter.emit()
                // particles.push(new Particle(pos, vel, mass, life, thisEmitter))

                let particle = emitter.emit()
                particles.push(particle)
            }
        }

        return particles
    }

    // PARTICLE DYNAMICS (TODO: consider moving to different class)

    computeDynamics(particles, forces, colliders, dt){

        let diffFunc = (x, v, m) => {

            let a = new THREE.Vector3(0, 0, 0)
            for (let force of forces){
                let fc = force.computeForce(x, v, m)
                a.add(fc)
            }
            a.divideScalar(m)

            return [v, a]
        }

        // basic method main step A
        let acc
        if (this.method == 0){
            acc = particles.map((x, i) => new THREE.Vector3(0, 0, 0))
            for (let force of forces){
                for (let i = 0; i < particles.length; i++){
                    let p = particles[i]
                    let forceOnI = force.computeForce(p.pos, p.vel, p.mass).multiplyScalar(0.05)
                    acc[i].add(forceOnI)
    
                }
            }
        }

        // COLLIDERS A
        let prevColStates = []
        for (let collider of colliders){
            let states = particles.map((x, i) => collider.whichSide(x.pos))
            prevColStates.push(states)
        }
        
        // basic method main step B
        if (this.method == 0){
            for (let i in acc){
                let p = particles[i]
                acc[i] = acc[i].divideScalar(p.mass)
                p.vel = p.vel.clone().add(acc[i])
                p.pos = p.pos.clone().addScaledVector(p.vel, 0.2)
            }
        }

        // MAIN STEP
        if (this.method > 0){
            for (let p of particles){
                let newX, newV
                [newX, newV] = this.solver(diffFunc, dt, p.pos, p.vel, p.mass)
                p.pos = newX
                p.vel = newV
            }
        }

        // COLLIDERS B
        for (let i in colliders){
            let collider = colliders[i]
            let states = particles.map((x, j) => collider.whichSide(x.pos))
            let collided = states.map((x, j) => x != prevColStates[i][j])
            for (let j in collided){
                if (collided[j])
                    particles[j] = collider.onCollide(particles[j])
            }
        }

        return particles
    }


    // UPDATE STEP (exposed to viz.js)

    update(dt){

        let t0 = Date.now()

        this.particles = this.computeEmissions(this.particles, this.emitters, dt)

        let t1 = Date.now()
        //console.log("emissions", (t1-t0))
    
        this.particles = this.computeDynamics(this.particles, this.forces, this.colliders, dt)

        let t2 = Date.now()
        //console.log("dynamics", (t2-t1))

        return this.particles

    }

}

export default SimulatorCPU


