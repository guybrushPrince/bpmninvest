function getMarker(faultType, messageType){
    console.log("generating marker");

    let config;

    if (faultType === 'NO_START'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="fault-overlay ${messageType} ${faultType.toLowerCase()}">⚠️ No start node found</div>`
        }
    }

    else if (faultType === 'NO_END'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="fault-overlay ${messageType} ${faultType.toLowerCase()}">⚠️ No end node found</div>`
        }
    }

    else if (faultType === 'IMPLICIT_START'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="fault-overlay ${messageType} ${faultType.toLowerCase()}">⚠️ An implicit start node found</div>`
        }
    }

    else if (faultType === 'IMPLICIT_END'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="fault-overlay ${messageType} ${faultType.toLowerCase()}">⚠️ An implicit end node found</div>`
        }
    }

    else if (faultType === 'GATEWAY_WITHOUT_MULTIPLE_FLOWS'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="fault-overlay ${messageType} ${faultType.toLowerCase()}">⚠️ Your gateway has only one flow</div>`
        }
    }

    else if (faultType === 'LOOP_EXIT_NOT_XOR'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="fault-overlay ${messageType} ${faultType.toLowerCase()}">⚠️ Loop exits need to be conditional splits</div>`
        }
    }

    else if (faultType === 'LOOP_ENTRY_IS_AND'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="fault-overlay ${messageType} ${faultType.toLowerCase()}">⚠️ Cyclic parallel gateway found</div>`
        }
    }

    else if (faultType === 'LOOP_BACK_JOIN_IS_AND'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="fault-overlay ${messageType} ${faultType.toLowerCase()}">⚠️ This should be a cyclic exclusive gateway</div>`
        }
    }

    else if (faultType === 'POTENTIAL_DEADLOCK'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="fault-overlay ${messageType} ${faultType.toLowerCase()}">⚠️ Possible process blockage</div>`
        }
    }

    else if (faultType === 'POTENTIAL_LACK_OF_SYNCHRONIZATION'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html:  `<div class="fault-overlay ${messageType} ${faultType.toLowerCase()}">⚠️ Possible unnecessary executions</div>`
        }
    }

    return config;
}

function getJQueryId(process, element, faultType){
    console.log("retrieving element id");

    let id;

    if (faultType === 'NO_START' || faultType === 'NO_END'){
        id = String(process.getId);
    }

    else if (faultType === 'IMPLICIT_START' || faultType === 'IMPLICIT_END'){
        id = element[0].getUI.data('element-id');
    }

    if (faultType === 'GATEWAY_WITHOUT_MULTIPLE_FLOWS'){
        id = $(element.getUI['0']).data('element-id');
    }

    else if (faultType === 'LOOP_EXIT_NOT_XOR'){
        id = element.exit.getUI.data('element-id');
    }

    else if (faultType === 'LOOP_ENTRY_IS_AND'){
        id = element.entry.getUI.data('element-id');
    }

    else if (faultType === 'LOOP_BACK_JOIN_IS_AND'){
        id = element.backJoin.getUI.data('element-id');
    }

    else if (faultType === 'POTENTIAL_DEADLOCK'){
        id = element.join.getUI.data('element-id');
    }

    else if (faultType === 'POTENTIAL_LACK_OF_SYNCHRONIZATION'){
        id = $(element.intersectionPoint.getUI[0]).data('element-id');
    }

    return id;
}

//TODO: put event listeners on the error alerts to open the side-panel for error fixing (depending on what info is written there, the
//      content of the error alerts (the sentences) should still be improved)
//TODO: error markers shouldn't be placed on top of each other
//NOTICE: if a loop doesn't have an exit, the code throws error (it can't handle this case)