# HOMEWORK 1 - MATEJ BEVEC 63190336

import sys
import os
import argparse
import struct
import time

import numpy as np
from tqdm import tqdm


def inrange(p, rng):
    """Return True if point p is in ranges rng in respective dims."""
    out = True
    for i in range(len(p)):
        out = out and (p[i] >= rng[i][0] and p[i] < rng[i][1])
    return out


class Octree():

    def __init__(self, limits, points=None, maxn=2):
        self.root = OctreeNode(limits[0:2], limits[2:4], limits[4:6], maxn)
        self.maxn = maxn
        self.idx = []

        if points is not None:
            for p in points:
                self.insert(p)

    def __str__(self, d=0):
        return str(self.root)
        
    def get_all(self):
        "Returns all points in the tree."
        return self.root.get_points()

    def get_knn(self, point, k):
        """Returns k nearest points to point."""
        #BODGE
        pts, idx = [], []
        r = 0.05
        while (True):
            pts, idx = self.get_in_radius(point, r)
            if len(pts) > k:
                pts, idx = np.array(pts), np.array(idx)
                dist = np.linalg.norm(pts - np.array(point), axis=1)
                ranks = np.argsort(dist)
                break
            r *= 2
        return pts[ranks][:k], idx[ranks][:k]

    def get_in_radius(self, point, R):
        """Returns all points within R radius of point."""

        pts = []
        idx = []
        center = self._find_node(point) #node where query is
        toexplore = set([center])
        explored = set()
        point = np.array(point)

        while (True):
            node = toexplore.pop()
            explored.add(node)
            dx = [node.xlim[0] - point[0], node.xlim[1] - point[0]]
            dy = [node.ylim[0] - point[1], node.ylim[1] - point[1]]
            dz = [node.zlim[0] - point[2], node.zlim[1] - point[2]]
            d = np.array(dx + dy + dz)
            # if distance is > radius, in any dimension, we don't need to explore this node
            if np.max(d) < R:
                nodepts, nodeidx = node.get_points()
                nodepts, nodeidx = np.array(nodepts), np.array(nodeidx)
                # add nodes to return set if within radius
                if len(nodepts) > 0:
                    inrad = nodepts[np.linalg.norm(nodepts - point, axis=1) < R]
                    for i in range(len(inrad)):
                        pts.append(list(nodepts[i]))
                        idx.append(nodeidx[i])
                # add sibling nodes to queue
                if node.parent:
                    for ch in node.parent.children:
                        if ch not in explored: toexplore.add(ch)
            if len(toexplore) == 0: break

        return pts, idx

    def _find_node(self, point):
        """Returns node in which point is stored."""

        node = self.root
        while (True):
            if len(node.children) == 0:
                return node
            node = node.children[node.which_child(point)]


    def insert(self, point):
        """Inserts point in the correct node, possibly creating new subnodes."""
        
        self.idx.append(len(self.idx))
        node = self.root
        while (True):
            if len(node.children) == 0:
                node.points.append(point)
                node.idx.append(self.idx[-1])
                if len(node.points) > self.maxn:
                    node.split()
                return
            node = node.children[node.which_child(point)]


class OctreeNode():

    def __init__(self, xlim, ylim, zlim, maxn):
        self.xlim = xlim
        self.ylim = ylim
        self.zlim = zlim
        self.splits = [None, None, None]
        self.points = []
        self.children = []
        self.maxn = maxn
        self.parent = None
        self.idx = []

    def __str__(self, d=0):
        string = "\nd=" +  str(d) + " " +  str(self.points)
        for ch in self.children:
            string += ch.__str__(d=d+1)
        return string
    
    def get_points(self):
        """Returns all points in this node, including its subnodes."""

        if len(self.children) == 0:
            return self.points, self.idx
        
        pts = []
        idx = []
        for ch in self.children:
            cpts, cidx = ch.get_points()
            pts.extend(cpts)
            idx.extend(cidx)
        
        return pts, idx

    def which_child(self, p):
        """Returns index of child node under which point p falls."""

        if len(self.children) == 0: return 
        idx = 0
        if p[0] > self.splits[0]: idx += 4
        if p[1] > self.splits[1]: idx += 2
        if p[2] > self.splits[2]: idx += 1
        return idx

    def split(self):
        """Splits this node into 8 subnodes and relocates points accordingly."""

        xl, yl, zl = self.xlim, self.ylim, self.zlim
        xs = (xl[0] + xl[1]) / 2
        ys = (yl[0] + yl[1]) / 2
        zs = (zl[0] + zl[1]) / 2
        self.splits = [xs, ys, zs]
        
        for a in range(2):
            for b in range(2):
                for c in range(2):

                    xlim = [xl[0] if a==0 else xs, xs if a==0 else xl[1]]
                    ylim = [yl[0] if b==0 else ys, ys if b==0 else yl[1]]
                    zlim = [zl[0] if c==0 else zs, zs if c==0 else zl[1]]

                    node = OctreeNode(xlim, ylim, zlim, self.maxn)
                    node.parent = self
                    
                    kept, kept_idx = [], []
                    for i in range(len(self.points)):
                        pt = self.points[i]
                        id = self.idx[i]
                        if inrange(pt, [xlim, ylim, zlim]):
                            node.points.append(pt)
                            node.idx.append(id)
                        else:
                            kept.append(pt)
                            kept_idx.append(id)
                    self.points = kept
                    self.idx = kept_idx
                    self.children.append(node)
                    

def interpolant(x, points_x, points_y, p):
    """Returns interpolated value at point x given scattered points_x with values points_y."""

    dist = np.linalg.norm(points_x - x, axis=1)
    W = dist ** (-p)
    minidx = np.nonzero(dist < 0.00001)[0]
    if len(minidx) > 0: 
        return points_y[minidx[0]]

    fhat = np.sum(W * points_y) / np.sum(W)
    return fhat

def shepard_simple(points_x, points_y, pred_x, p=2):
    
    pred_y = []
    pbar = tqdm(total=len(pred_x))

    for i, px in enumerate(pred_x):
        if i%2000 == 0: pbar.update(2000)
        py = interpolant(px, points_x, points_y, p)
        pred_y.append(py)

    return np.array(pred_y)


def interpolant_modified(x, points_x, points_y, R):
    """Returns interpolated value at point x given scattered points_x with values points_y and radius of influence R."""

    dist = np.linalg.norm(points_x - x, axis=1)
    top = R - dist
    top[top < 0] = 0
    bottom = R*dist
    W = top / bottom

    fhat = np.sum(W * points_y) / np.sum(W)
    return fhat

def shepard_modified(points_x, points_y, pred_x, limits=[0,1, 0,1, 0,1], R=0.1):

    pred_y = []
    tree = Octree(limits, points_x)
    pbar = tqdm(total=len(pred_x))
    
    for i, px in enumerate(pred_x):
        if i%2000 == 0: pbar.update(2000)
        pts, idx = tree.get_in_radius(px, R)
        #print(px, idx)
        if len(idx) == 0:
            id = tree.get_knn(px, 1)[1][0]
            py = points_y[id]
        else:
            knn_x, knn_y = points_x[idx], points_y[idx]
            py = interpolant_modified(px, knn_x, knn_y, R)
        pred_y.append(py)

    return np.array(pred_y)

def read_input(pth):
    with open(pth, "rb") as f:
        n = struct.unpack("<i", f.read(4))[0]
        pts = []
        vals = []
        for i in range(n):
            x = struct.unpack("<f", f.read(4))[0]
            y = struct.unpack("<f", f.read(4))[0]
            z = struct.unpack("<f", f.read(4))[0]
            v = struct.unpack("<f", f.read(4))[0]
            pts.append([x, y, z])
            vals.append(v)
    return np.array(pts), np.array(vals)

def write_output(pth, grid_vals, uint=False):
    print(uint)
    with open(pth, "wb") as f:
        f.write(grid_vals)

if __name__ == "__main__":

    # tree = Octree([0,1, 0,1, 0,1])

    # tree.insert([0.2, 0.1, 0.5])
    # tree.insert([0.2, 0.2, 0.5])
    # tree.insert([0.3, 0.2, 0.5])
    # tree.insert([0.3, 0.1, 0.6])
    # tree.insert([0.3, 0.1, 0.6])
    # tree.insert([0.3, 0.1, 0.6])
    # tree.insert([0.3, 0.1, 0.4])
    # tree.insert([0.3, 0.1, 0.4])

    # pts = tree.get_in_radius([0.2, 0.2, 0.2], 1)
    # print(pts)

    parser = argparse.ArgumentParser()
    parser.add_argument("-i", "--input")
    parser.add_argument("-o", "--output", default="out.raw")
    parser.add_argument("-m", "--method", default="simple")
    parser.add_argument("-p", "--p", default=3)
    parser.add_argument("-R", "--R", default=0.05)
    parser.add_argument("-mnx", "--min-x", default=0)
    parser.add_argument("-mny", "--min-y", default=0)
    parser.add_argument("-mnz", "--min-z", default=0)
    parser.add_argument("-mx", "--max-x", default=1)
    parser.add_argument("-my", "--max-y", default=1)
    parser.add_argument("-mz", "--max-z", default=1)
    parser.add_argument("-rx", "--res-x", default=64)
    parser.add_argument("-ry", "--res-y", default=64)
    parser.add_argument("-rz", "--res-z", default=64)
    parser.add_argument("-t", "--type", default="float")

    args = parser.parse_args()

    print("Reading input data...")
    xvals = np.linspace(float(args.min_x), float(args.max_x), int(args.res_x))
    yvals = np.linspace(float(args.min_y), float(args.max_y), int(args.res_y))
    zvals = np.linspace(float(args.min_z), float(args.max_z), int(args.res_z))

    

    grid_points = []
    for z in zvals:
        for y in yvals:
            for x in xvals:
                grid_points.append([x, y, z])
    grid_points = np.array(grid_points)

    cloud_points, cloud_vals = read_input(args.input)

    print("Running Shepard's interpolation method...")
    x0 = time.time()

    if args.method == "simple":
        grid_vals = shepard_simple(cloud_points, cloud_vals, grid_points, p=int(args.p))
    else:
        limits = [float(args.min_x), float(args.max_x), float(args.min_y), float(args.max_y), float(args.min_z), float(args.max_z)]
        grid_vals = shepard_modified(cloud_points, cloud_vals, grid_points, limits=limits, R=float(args.R))

    print("Done. Elapsed: ", time.time() - x0, "s")

    
    print("Writing output...")
    use_int = False if args.type == "float" else True
    if use_int:
        grid_vals = (np.array(grid_vals) * 255).astype(np.uint8)


    write_output(args.output, grid_vals, use_int)

    
