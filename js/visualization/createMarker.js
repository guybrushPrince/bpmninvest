function getMarker(faultType, messageType){

    let config;

    if (faultType === 'NO_START'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: `<div class="${messageType}">No start node found</div>`
        }
    }

    else if (faultType === 'NO_END'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: `<div class="${messageType}">No end node found</div>`
        }
    }

    else if (faultType === 'IMPLICIT_START'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: `<div class="${messageType}">An implicit start node found</div>`
        }
    }

    else if (faultType === 'IMPLICIT_END'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: `<div class="${messageType}">An implicit end node found</div>`
        }
    }

    else if (faultType === 'GATEWAY_WITHOUT_MULTIPLE_FLOWS'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: `<div class="${messageType}">Your gateway has only one flow</div>`
        }
    }

    else if (faultType === 'LOOP_EXIT_NOT_XOR'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: `<div class="${messageType}">Loop exits need to be conditional splits</div>`
        }
    }

    else if (faultType === 'LOOP_ENTRY_IS_AND'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: `<div class="${messageType}">Cyclic parallel gateway found</div>` //back joins can only be exclusive not cycli
        }
    }

    else if (faultType === 'LOOP_BACK_JOIN_IS_AND'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: `<div class="${messageType}">This should be a cyclic exclusive gateway</div>`
        }
    }

    else if (faultType === 'POTENTIAL_DEADLOCK'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: `<div class="${messageType}">Possible process blockage</div>`
        }
    }

    else if (faultType === 'POTENTIAL_LACK_OF_SYNCHRONIZATION'){
        config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: `<div class="${messageType}">possible unnecessary executions</div>`
        }
    }

    return config;
}

function getJQueryId(process, element, faultType){

    let id;

    if (faultType === 'NO_START' || faultType === 'NO_END'){
        id = process.getId;
    }

    else if (faultType === 'IMPLICIT_START' || faultType === 'IMPLICIT_END'){
        if (element[0].getType === "VirtualTask"){
            id = element[0].getUI.data('element-id');
        }
    }

    else if (faultType === 'LOOP_EXIT_NOT_XOR'){
        id = element.exit.getUI.data('element-id');
    }

    else if (faultType === 'LOOP_ENTRY_IS_AND'){
        id = element.entry.getUI.data('element-id');
    }

    else if (faultType === 'LOOP_BACK_JOIN_IS_AND'){
        id = element.backjoin.getUI.data('element-id');
    }

    else if (faultType === 'POTENTIAL_DEADLOCK'){
        id = element.join.getUI.data('element-id');
    }

    else if (faultType === 'POTENTIAL_LACK_OF_SYNCHRONIZATION'){
        // let jQElement = element.intersectionPoint.getUI[0];
        // id = jQElement.attr('data-element-id');
        id = element.intersectionPoint.getUI[0].data('element-id');
    }

    return {id: id};
}