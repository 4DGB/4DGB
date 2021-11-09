/*
Copyright (c) 2021, Triad National Security, LLC. All rights reserved.
  
Redistribution and use in source and binary forms, with or
without modification, are permitted provided that the following conditions
are met:
    1. Redistributions of source code must retain the above copyright notice, 
       this list of conditions and the following disclaimer.

    2. Redistributions in binary form must reproduce the above copyright
       notice, this list of conditions and the following disclaimer in the
       documentation and/or other materials provided with the distribution.

    3. Neither the name of Los Alamos National Security, LLC, Los Alamos
       National Laboratory, LANL, the U.S. Government, nor the names of its
       contributors may be used to endorse or promote products derived from 
       this software without specific prior written permission.
    
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS CONTRIBUTORS "AS IS" AND 
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED 
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL LOS ALAMOS NATIONAL SECURITY, LLC OR CONTRIBUTORS 
BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR 
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE 
GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) 
HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT 
LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

require('three/examples/js/controls/OrbitControls')

const Client = require('./Client');
const Project = require('./Project');
const Geometry = require('./Geometry');
const AxesCanvas = require('./AxesCanvas');
const ScalarBarCanvas = require('./ScalarBarCanvas');
const Segment = require('./Segment');
const Util = require('./Util');
const { Selection, Controller } = require('./selections');

class GeometryCanvas {

    // class global settings
    static ShowUnmappedSegments = false;

    constructor(project, dataset, rootElemID) {
        this.renderRequested = false;
        this.camera;
        this.canvas;
        this.controls;
        this.scene;
        this.renderer;
        this.unmapped = [];
        this.loaded = false;
        this.setDataset(dataset);

        // bind this pointer to appropriate class methods
        this.postLoad = this.postLoad.bind(this);

        /**
         * @type {Controller} Selection controller used to sync selections with other components.
         */
        this.controller;

        /**
         * If a 'selectionChanged' event is triggered before the Geometry has finished
         * loading, this will get set to that selection event's object. It will be applied
         * as soon as loading has finished.
         */
        this.pendingSelection = null;

        this.render = (function() {
            this.renderRequested = undefined;

            // TODO: improve granularity of control for this
            this.showUnmappedSegments( GeometryCanvas.ShowUnmappedSegments );

            if (this.resizeRendererToDisplaySize(this.renderer)) {
                const canvas = this.renderer.domElement;
                this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
                this.camera.updateProjectionMatrix();
            }

            this.renderer.render(this.scene, this.camera);
            this.axesCanvas.render();
        }).bind(this);

        this.requestRenderIfNotRequested = (function() {
            if (!this.renderRequested) {
                this.renderRequested = true;
                requestAnimationFrame(this.render);
            }
        }).bind(this);

        //
        // end of instance variables
        //

        // set up each state from the project data
        // var proj  = project.getProject();
        var adata = project.getApplicationData("gtk");
        var gdata = adata["geometrycanvas"] 

        // create elements in the document 
        var gtkroot = document.getElementById(rootElemID);
        // var groot  = document.createElement("td");
        // gtkroot.appendChild(groot);

        var contdiv = document.createElement("div");
        contdiv.className = "gtkviewcontainer";
        gtkroot.appendChild(contdiv);

        var canvas_idstring = "gtkgeometry-" + this.dataset.id.toString();
        this.canvas = document.createElement("canvas");
        this.canvas.className = "gtkgeometrycanvas";
        this.canvas.id = canvas_idstring; 
        this.canvas.width  = gdata["width"];
        this.canvas.height = gdata["height"];
        contdiv.appendChild(this.canvas);

        // renderer
        this.renderer = new THREE.WebGLRenderer({canvas: this.canvas, antialias: true});
        this.renderer.shadowMap.enabled = true;

        // camera
        var cam = gdata["scene"]["camera"];
        this.camera= new THREE.PerspectiveCamera(cam["fov"], cam["aspect"], cam["near"], cam["far"]);
        this.camera.position.x = cam["position"][0];
        this.camera.position.y = cam["position"][1];
        this.camera.position.z = cam["position"][2];
        this.camera.aspect = this.canvas.width/this.canvas.height;
        this.camera.updateProjectionMatrix();

        // controls
        // this.controls = new THREE.TrackballControls(this.camera, this.canvas);
        this.controls = new THREE.OrbitControls(this.camera, this.canvas);
        this.controls.target.set(cam["center"][0], cam["center"][1], cam["center"][2]);
        this.controls.update();
        this.controls.addEventListener('change', this.requestRenderIfNotRequested);
        window.addEventListener('resize', this.requestRenderIfNotRequested);

        // new scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(parseInt(gdata["scene"]["background"])); 

        // axes
        if (false) {
            this.axes = new THREE.AxesHelper( 1 );
            this.scene.add(this.axes);
        }

        // add lights to the scene
        var lights = gdata["scene"]["lights"];
        var curLight;
        // build and add all the lights defined in the project settings
        for (var l in Object.keys(lights)) {
            curLight = lights[l];
            if (curLight["type"] == "directional") {
                light = new THREE.DirectionalLight(curLight["color"], curLight["intensity"]);
                light.position.set(curLight["position"][0], curLight["position"][1], curLight["position"][2] );
                if ("shadow" in curLight) {
                    light.castShadow            = curLight["shadow"]["castshadow"];
                    light.shadow.camera.near    = curLight["shadow"]["camera"]["near"];
                    light.shadow.camera.far     = curLight["shadow"]["camera"]["far"];
                    light.shadow.camera.top     = curLight["shadow"]["camera"]["top"];
                    light.shadow.camera.bottom  = curLight["shadow"]["camera"]["bottom"];
                    light.shadow.camera.left    = curLight["shadow"]["camera"]["left"];
                    light.shadow.camera.right   = curLight["shadow"]["camera"]["right"];
                }
                //  debugging
                if (false) {
                    const helper = new THREE.CameraHelper( light.shadow.camera );
                    this.scene.add(helper);
                }
                this.scene.add(light);
                
            } else if (curLight["type"] == "point") {
                var light = new THREE.PointLight(curLight["color"], curLight["intensity"], curLight["distance"], curLight["decay"]);
                light.position.set(curLight["position"][0], curLight["position"][1], curLight["position"][2] );
                this.scene.add(light);

            } else if (curLight["type"] == "ambient") {
                var light = new THREE.AmbientLight(curLight["color"], curLight["intensity"]);
                this.scene.add(light);
            } else {
                // report ignored light type, but this is not an error 
                console.log("Unknown light type in project: " + curLight["type"])
            }
        }

        // axes
        this.axesCanvas = new AxesCanvas(contdiv, this.camera);

        // load data
        this.geometry = new Geometry(this.dataset.structure, gdata["geometry"]);
        this.geometry.addListener('loaded', this.postLoad);
        Client.TheClient.get_structure(this.geometry.load, this.geometry.id);
        // this.geometry.load( this.dataset.id, this );

        // scalar bar
        this.scalarBarCanvas = new ScalarBarCanvas(contdiv);
            // share the geometry's LUT
        this.scalarBarCanvas.setLUT(this.geometry.LUT);
    }

    /**
     * Set a new selection controller for the Geometry Canvas.
     * This will cause the displayed segments to react to 'selectionChanged' events
     * from the controller.
     * @param {Controller} controller 
     */
    setController(controller) {
        this.controller = controller;
        this.controller.addListener('selectionChanged', (e) => this.onSelectionChanged(e) );
    }

    setRotationCenter( center ) {
        this.controls.target.set(center.x, center.y, center.z);
        this.controls.update();
    }

    /**
     * Called in response to 'selectionChanged' events. Sets the visibility of segments
     */
    onSelectionChanged(selectionEvent) {
        // If we haven't finished loading, put this selection event on hold
        // (It'll be triggered again as soon as loading has finished)
        if (!this.loaded) {
            this.pendingSelection = selectionEvent;
            return;
        }

        const {selection} = selectionEvent;
        const segmentIDs = Util.rangesToValues( selection.asSegments() );
        this.setSegmentStates(segmentIDs, Segment.State.LIVE, Segment.State.GHOST);
        this.render();
    }

    showAxes( state ) {
        this.showAxes.visible = state;
    }

    showCentroid( state ) {
        this.geometry.showCentroid(state);
    }

    // color must be of the form #000000
    setBackgroundColor( color ) {
        this.scene.background.set(color)
    }

    setSegmentStates( segments, setState, unsetState ) {
        this.geometry.setSegmentStates(segments, setState, unsetState);
    }

    // update after data loaded
    postLoad() {
        // add the loaded geometry to the scene
        this.geometry.addToScene(this.scene);

        // set the centroid
        this.setRotationCenter( this.geometry.centroid );

        // set the colors
        // instance.paintByVariable();
         
        // turn off the unmapped ones
        this.showUnmappedSegments( this.ShowUnmappedSegments );
        // instance.geometry.setSegmentVisible(instance.unmapped, false);

        this.loaded = true;
        // If a selection was set while we were loading, apply it now
        if (this.pendingSelection) {
            this.onSelectionChanged(this.pendingSelection);
        }
    }

    // render on changes
    resizeRendererToDisplaySize(renderer) {
        // const canvas = this.renderer.domElement;
        const width  = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        const resize = this.canvas.width !== width || this.canvas.height !== height;

        if (resize) {
            this.renderer.setSize(width, height, false);
        }

        return resize;
    }

    initializeUnmappedSegments() {
        var structure = Project.TheProject.getData("structure", this.dataset.structure);

        if ("unmapped_segments" in structure) {
            var umList = structure["unmapped_segments"];
            for ( var l=0; l<umList.length;l++ ) {
                var start = umList[l][0];
                var end   = umList[l][1];
                var numelems = end - start;
                for (var i=0;i<numelems+1;i++) {
                    this.unmapped.push(start + i);
                }
            }
        }
    }

    reset() {
        // no-op for now
    }

    showUnmappedSegments( state ) {
        this.geometry.setSegmentVisible(this.unmapped, state);
    }

    setDataset(d) {
        this.reset();
        this.dataset = d;
        this.initializeUnmappedSegments();
        if (this.loaded) {
            this.showUnmappedSegments(this.ShowUnmappedSegments);
        }
    }

    setLUT (lut) {
        this.geometry.setLUT(lut);
    }

    setLUTParameters (varname, min, max) {
        this.geometry.setLUTParameters(min, max);
        this.scalarBarCanvas.title = varname;
    }

}

module.exports = GeometryCanvas;
