#include <stdio.h>
#include <signal.h>
#include <string.h>
#include <unistd.h>

#include "fault.h"
#include "motor.h"
#include "sensor.h"
#include "utils.h"

static const int WATER_LEVEL_ON_THRESHOLD = 30;
static const int WATER_LEVEL_OFF_THRESHOLD = 90;
static const int LOOP_DELAY_SECONDS = 2;
static const char *STATUS_FILE_PATH = "../data/status.json";
static volatile sig_atomic_t keep_running = 1;

static void handle_sigint(int signal_value) {
    (void)signal_value;
    keep_running = 0;
}

int main(void) {
    int prev_level = 0;

    /* Register a shutdown signal so motor and GPIO are always released safely. */
    signal(SIGINT, handle_sigint);
    motor_init();

    while (keep_running) {
        int level = get_water_level();
        int motor_state;
        int fault_code;
        const char *fault_label;
        const char *motor_label;
        char mode[COMMAND_MODE_MAX_LEN];
        char motor_cmd[COMMAND_MOTOR_MAX_LEN];
        char timestamp[TIMESTAMP_BUFFER_SIZE];

        read_command(mode, motor_cmd);
        printf("[CMD] Mode: %s | Motor Command: %s\n", mode, motor_cmd);

        /*
         * MANUAL mode gives the backend direct authority over the motor.
         * AUTO mode keeps embedded fallback logic active for autonomous operation.
         */
        if (strcmp(mode, "MANUAL") == 0) {
            if (strcmp(motor_cmd, "ON") == 0) {
                motor_on();
            } else {
                motor_off();
            }
        } else {
            if (level < WATER_LEVEL_ON_THRESHOLD) {
                motor_on();
            } else if (level > WATER_LEVEL_OFF_THRESHOLD) {
                motor_off();
            }
        }

        motor_state = get_motor_state();
        /* Compare current and previous level to detect dry-run style faults reliably. */
        fault_code = detect_fault(prev_level, level, motor_state);

        /* Critical protection always overrides AUTO/MANUAL commands for safety. */
        if (fault_is_critical(fault_code) && motor_state) {
            motor_off();
            motor_state = get_motor_state();
        }

        fault_label = fault_to_string(fault_code);
        motor_label = motor_state ? "ON" : "OFF";

        printf("[INFO] Level: %d%% | Motor: %s | Fault: %s\n", level, motor_label, fault_label);

        get_current_timestamp(timestamp, TIMESTAMP_BUFFER_SIZE);
        if (write_status_json(STATUS_FILE_PATH, level, motor_state, mode, fault_label, timestamp) != 0) {
            perror("Failed to write status.json");
        } else {
            printf("[INFO] Status JSON updated: %s\n", STATUS_FILE_PATH);
        }

        /* Preserve previous level for next-cycle trend-based fault detection. */
        prev_level = level;

        sleep(LOOP_DELAY_SECONDS);
    }

    /* Explicit safe-stop sequence before process exit. */
    motor_off();
    motor_cleanup();
    printf("System safely stopped\n");

    return 0;
}