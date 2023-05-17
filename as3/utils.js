import * as THREE from 'three';


export function indexArray(arr, idx){
    // returns arr elements at indices idx

    let idxSet = new Set(idx)
    let filtered = arr.filter( (val, i) =>  idxSet.has(i))
    return filtered
}


export function sampleUniform(range){
    // returns uniformly random float between range[0] and range[1]

    return range[0] + Math.random() * (range[1] - range[0])
}


export function randomInt(min, max){
    // returns random integer between min, inclusive, and max, exclusive

    return Math.floor(Math.random() * (max - min) + min)
}


export function perpendicularVector(vec){
    // returns one of perpendicular vectors to vec

    if (vec.x == -1 && vec.y == 1 && vec.z == 0)
        return new THREE.Vector3(-1, -1, -1)

    return new THREE.Vector3(vec.z, vec.z, -vec.x - vec.y)
}


export function eulerStep(F, h, x, v, m){
    // solves one timestep for the equation F using Euler's method

    // F(x, v, m) should return [dx, dv] = [v, acceleration(x, v, m)]

    let dx, dv
    [dx, dv] = F(x, v, m)

    let newX = x.clone().addScaledVector(dx, h)
    let newV = v.clone().addScaledVector(dv, h)

    return [newX, newV]
}


export function rungeKuttaStep(F, h, x, v, m){
    // solves one timestep for the equation F using Runge-Kutta 4th order method

    // F(x, v, m) should return [dx, dv] = [v, acceleration(x, v, m)]

    // k is a duple of vectors [x, v]

    let k1 = F(x, v, m)
    let k2 = F(x.clone().addScaledVector(k1[0], h/2), v.clone().addScaledVector(k1[1], h/2), m)
    let k3 = F(x.clone().addScaledVector(k2[0], h/2), v.clone().addScaledVector(k2[1], h/2), m)
    let k4 = F(x.clone().addScaledVector(k1[0], h), v.clone().addScaledVector(k1[1], h), m)

    let dx = k1[0].clone().addScaledVector(k2[0], 2).addScaledVector(k3[0], 2).add(k4[0]).multiplyScalar(h/6)
    let dv = k1[1].clone().addScaledVector(k2[1], 2).addScaledVector(k3[1], 2).add(k4[1]).multiplyScalar(h/6)

    let newX = x.clone().add(dx)
    let newV = v.clone().add(dv)

    return [newX, newV]

}

export async function loadJSON(path){
    // fetches and parses a json file to obj

    let res = await fetch(path)
    let json = await res.json()
    return json
}