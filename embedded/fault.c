#include "fault.h"

#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#define DRY_RUN_LIMIT_CYCLES 3
#define OVERFILL_LEVEL_PERCENT 95
#define MOTOR_TIMEOUT_SECONDS 120
#define SENSOR_HISTORY_SIZE 5
#define SENSOR_JUMP_THRESHOLD 30

int detect_fault(int prev_level, int current_level, int motor_state) {
    static int no_rise_counter = 0;
    static time_t motor_started_at = 0;
    static int recent_levels[SENSOR_HISTORY_SIZE] = {0};
    static int recent_count = 0;
    static int recent_index = 0;
    static int last_announced_fault = FAULT_NONE;
    int large_jump_count = 0;
    int i = 0;
    int fault_code = FAULT_NONE;

    recent_levels[recent_index] = current_level;
    recent_index = (recent_index + 1) % SENSOR_HISTORY_SIZE;
    if (recent_count < SENSOR_HISTORY_SIZE) {
        recent_count++;
    }

    if (recent_count == SENSOR_HISTORY_SIZE) {
        for (i = 1; i < SENSOR_HISTORY_SIZE; i++) {
            int prev = recent_levels[(recent_index + i - 1) % SENSOR_HISTORY_SIZE];
            int curr = recent_levels[(recent_index + i) % SENSOR_HISTORY_SIZE];
            if (abs(curr - prev) > SENSOR_JUMP_THRESHOLD) {
                large_jump_count++;
            }
        }
    }

    if (current_level >= OVERFILL_LEVEL_PERCENT) {
        fault_code = FAULT_OVERFILL;
    } else if (large_jump_count >= 2) {
        fault_code = FAULT_SENSOR_ERROR;
    } else if (current_level == 0) {
        fault_code = FAULT_EMPTY_SUMP;
    } else {
        if (motor_state) {
            if (motor_started_at == 0) {
                motor_started_at = time(NULL);
            } else if ((time(NULL) - motor_started_at) > MOTOR_TIMEOUT_SECONDS) {
                fault_code = FAULT_TIMEOUT;
            }

            if (current_level <= prev_level) {
                no_rise_counter++;
            } else {
                no_rise_counter = 0;
            }
        } else {
            no_rise_counter = 0;
            motor_started_at = 0;
        }

        if (fault_code == FAULT_NONE && no_rise_counter >= DRY_RUN_LIMIT_CYCLES) {
            fault_code = FAULT_DRY_RUN;
        }
    }

    if (fault_code != FAULT_TIMEOUT && !motor_state) {
        motor_started_at = 0;
    }

    if (fault_code != last_announced_fault) {
        if (fault_code == FAULT_OVERFILL) {
            printf("[FAULT] OVERFILL detected\n");
        } else if (fault_code == FAULT_TIMEOUT) {
            printf("[FAULT] TIMEOUT detected\n");
        } else if (fault_code == FAULT_SENSOR_ERROR) {
            printf("[FAULT] SENSOR_ERROR detected\n");
        }
        last_announced_fault = fault_code;
    }

    return fault_code;
}

int fault_is_critical(int fault_code) {
    return fault_code == FAULT_OVERFILL || fault_code == FAULT_TIMEOUT || fault_code == FAULT_SENSOR_ERROR;
}

const char *fault_to_string(int fault_code) {
    switch (fault_code) {
        case FAULT_DRY_RUN:
            return "DRY_RUN";
        case FAULT_EMPTY_SUMP:
            return "EMPTY_SUMP";
        case FAULT_OVERFILL:
            return "OVERFILL";
        case FAULT_TIMEOUT:
            return "TIMEOUT";
        case FAULT_SENSOR_ERROR:
            return "SENSOR_ERROR";
        case FAULT_NONE:
        default:
            return "NONE";
    }
}
