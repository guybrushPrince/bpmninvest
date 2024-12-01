let getMarker = function (fault){

    if (fault === 'NO_START'){
        let config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: '<div class="diagram-note">No start node found</div>'
        }
        return config;
    }

    if (fault === 'NO_END'){
        let config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: '<div class="diagram-note">No end nodes found</div>'
        }
        return config;
    }

    if (fault === 'IMPLICIT_START'){
        let config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: '<div class="diagram-note">An implicit start node found</div>'
        }
        return config;
    }

    if (fault === 'IMPLICIT_END'){
        let config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: '<div class="diagram-note">An implicit end node found</div>'
        }
        return config;
    }

    if (fault === 'GATEWAY_WITHOUT_MULTIPLE_FLOWS'){
        let config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: '<div class="diagram-note">Your gateway has only one flow</div>'
        }
        return config;
    }

    if (fault === 'LOOP_EXIT_NOT_XOR'){
        let config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: '<div class="diagram-note">Loop exits need to be conditional splits</div>'
        }
        return config;
    }

    if (fault === 'LOOP_ENTRY_IS_AND'){
        let config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: '<div class="diagram-note">Loop entries can not be AND</div>'
        }
        return config;
    }

    if (fault === 'LOOP_BACK_JOIN_IS_AND'){
        let config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: '<div class="diagram-note">Loop back joins can not be AND</div>'
        }
        return config;
    }

    if (fault === 'POTENTIAL_DEADLOCK'){
        let config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: '<div class="diagram-note">Possible process blockage</div>'
        }
        return config;
    }

    if (fault === 'POTENTIAL_LACK_OF_SYNCHRONIZATION'){
        let config = {
            position: {
                bottom: 0,
                right: 0
            },
            html: '<div class="diagram-note">possible unnecessary executions</div>'
        }
        return config;
    }
}