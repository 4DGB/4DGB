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

var ThePanels = [];
var TheControls;
var TheChartPanel;

function addTrackCallback() {
    alert("track clicked")
}

function createTrack ( data ) {
    TheCharts.addTracks( "label", addTrackCallback, [0, 1], "chrX", 0, 100);
}

function linkCameras(a, b) {
    // link the cameras
    a.controls.addEventListener( 'change', () => {
        b.camera.copy( a.camera, true );
        b.controls.target = a.controls.target;
        b.render();
    });
    b.controls.addEventListener( 'change', () => {
        a.camera.copy( b.camera, true );
        a.controls.target = b.controls.target;
        a.render();
    });
}

function setVariable( id ) {
    TheGTKClient.get_array( (response) => {
            ThePanels[0].geometrycanvas.geometry.setLUTParameters( response['data']['min'], response['data']['max'] ); 
            ThePanels[0].geometrycanvas.geometry.colorBy( response['data']['values']);
            ThePanels[0].geometrycanvas.render();
        }, id, 0); 
    TheGTKClient.get_array( (response) => {
            ThePanels[1].geometrycanvas.geometry.setLUTParameters( response['data']['min'], response['data']['max'] ); 
            ThePanels[1].geometrycanvas.geometry.colorBy( response['data']['values']);
            ThePanels[1].geometrycanvas.render();
        }, id, 1); 
}

function variableChanged(e) {
    setVariable(e);
}

function colormapChanged(e) {
    ThePanels[0].geometrycanvas.geometry.setLUT(e);
    ThePanels[1].geometrycanvas.geometry.setLUT(e);
    setVariable(TheControls.getCurrentVariableID());
}

function main( project ) {
    var dset = project.getDatasets(); 

    // control panel
    TheControls = new GTKControlPanel( project, "controlpanel" );

    // views
    var dataset = new GTKDataset(dset[0]);
    ThePanels.push(new GTKViewerPanel( project, dataset, "leftpanel" ));

    var dataset = new GTKDataset(dset[1]);
    ThePanels.push(new GTKViewerPanel( project, dataset, "rightpanel" ));

    // attribute charts
    TheCharts = new GTKChartPanel( "chartpanel" );


    // connections
        // camera
    linkCameras(ThePanels[0].geometrycanvas, ThePanels[1].geometrycanvas);
        // events
    TheControls.addEventListener( "variableChanged", variableChanged );
    TheControls.addEventListener( "colormapChanged", colormapChanged );
    TheControls.addEventListener( "createTrack", createTrack );
}

//
// create the project object and load data 
//
TheGTKProject = new GTKProject( GTKProjectName );
TheGTKClient  = new GTKClient( "http://" + window.location.hostname, window.location.port);
var view;

main( TheGTKProject );
