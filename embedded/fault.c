#include "fault.h"

#define DRY_RUN_LIMIT_CYCLES 3

int detect_fault(int prev_level, int current_level, int motor_state) {
    static int no_rise_counter = 0;

    if (current_level == 0) {
        no_rise_counter = 0;
        return FAULT_EMPTY_SUMP;
    }

    if (motor_state) {
        if (current_level <= prev_level) {
            no_rise_counter++;
        } else {
            no_rise_counter = 0;
        }
    } else {
        no_rise_counter = 0;
    }

    if (no_rise_counter >= DRY_RUN_LIMIT_CYCLES) {
        return FAULT_DRY_RUN;
    }

    return FAULT_NONE;
}

const char *fault_to_string(int fault_code) {
    switch (fault_code) {
        case FAULT_DRY_RUN:
            return "DRY_RUN";
        case FAULT_EMPTY_SUMP:
            return "EMPTY_SUMP";
        case FAULT_NONE:
        default:
            return "NONE";
    }
}
