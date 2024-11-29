let startSubscription = function(){
    faultBus.subscribe(processFault);
}

let processFault = async function(type, process, elements, fault){
    console.log("processFault function is logging: ", type, process, elements, fault);

    // import diagram
    try {

        await bpmnModeler.importXML(bpmnXML);

        // access modeler components
        var canvas = bpmnModeler.get('canvas');
        var overlays = bpmnModeler.get('overlays');


        // zoom to fit full viewport
        canvas.zoom('fit-viewport');

        // attach an overlay to a node
        overlays.add(elements, 'note', {
            position: {
                bottom: 0,
                right: 0
            },
            html: '<div class="diagram-note">Mixed up the labels?</div>'
        });

        // add marker
        canvas.addMarker(elements, 'needs-discussion');
    } catch (err) {

        console.error('could not import BPMN 2.0 diagram', err);
    }
}