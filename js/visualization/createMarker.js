function getMarker(faultType, messageType){
    console.log("marker generated");

    let config;

    if (faultType === 'NO_START'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="${messageType}">⚠️ No start node found</div>`   //Fehler wird nicht erkannt
        }
    }

    else if (faultType === 'NO_END'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="${messageType}">⚠️ No end node found</div>` //Fehler wird nicht erkannt
        }
    }

    else if (faultType === 'IMPLICIT_START'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="${messageType}">⚠️ An implicit start node found</div>`  //x
        }
    }

    else if (faultType === 'IMPLICIT_END'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="${messageType}">⚠️ An implicit end node found</div>`       //x
        }
    }

    else if (faultType === 'GATEWAY_WITHOUT_MULTIPLE_FLOWS'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="${messageType}">⚠️ Your gateway has only one flow</div>`    //x
        }
    }

    else if (faultType === 'LOOP_EXIT_NOT_XOR'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="${messageType}">⚠️ Loop exits need to be conditional splits</div>`  //fine
        }
    }

    else if (faultType === 'LOOP_ENTRY_IS_AND'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="${messageType}">⚠️ Cyclic parallel gateway found</div>`     //fine
        }
    }

    else if (faultType === 'LOOP_BACK_JOIN_IS_AND'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="${messageType}">⚠️ This should be a cyclic exclusive gateway</div>`     //x
        }
    }

    else if (faultType === 'POTENTIAL_DEADLOCK'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="${messageType}">⚠️ Possible process blockage</div>`     //fine
        }
    }

    else if (faultType === 'POTENTIAL_LACK_OF_SYNCHRONIZATION'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="${messageType}">⚠️ Possible unnecessary executions</div>`       //fine
        }
    }

    return config;
}

function getJQueryId(process, element, faultType){
    console.log("element id retrieved");

    let id, x, y;
    let domElement;

    if (faultType === 'NO_START' || faultType === 'NO_END'){
        id = String(process.getId);
    }

    else if (faultType === 'IMPLICIT_START' || faultType === 'IMPLICIT_END'){
        if (element[0].getType === "VirtualTask"){
            domElement = element[0].getUI;
            id = String(domElement.data('element-id'));
        }
    }

    else if (faultType === 'LOOP_EXIT_NOT_XOR'){
        domElement = element.exit.getUI;
        id = String(domElement.data('element-id'));
    }

    else if (faultType === 'LOOP_ENTRY_IS_AND'){
        domElement = element.entry.getUI;
        id = String(domElement.data('element-id'));
    }

    else if (faultType === 'LOOP_BACK_JOIN_IS_AND'){
        domElement = element.backjoin.getUI;
        id = String(domElement.data('element-id'));
    }

    else if (faultType === 'POTENTIAL_DEADLOCK'){
        domElement = element.join.getUI;
        id = String(domElement.data('element-id'));
    }

    else if (faultType === 'POTENTIAL_LACK_OF_SYNCHRONIZATION'){
        domElement = $(element.intersectionPoint.getUI[0]);
        id = String(domElement.data('element-id'));
    }

    return id;
}

//TODO: block of implicit end/start: what if the if clause does not return true?
//TODO: put event listeners on the error alerts to open the side-panel for error fixing (depending on what info is written there, the
//      content of the error alerts (the sentences) should still be improved)
//TODO: error markers shouldn't be placed jon top of each other
//TODO: the same error tag should not be placed multiple times on the same element