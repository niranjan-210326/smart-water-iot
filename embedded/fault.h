#ifndef FAULT_H
#define FAULT_H

#define FAULT_NONE 0
#define FAULT_DRY_RUN 1
#define FAULT_EMPTY_SUMP 2
#define FAULT_OVERFILL 3
#define FAULT_TIMEOUT 4
#define FAULT_SENSOR_ERROR 5

int detect_fault(int prev_level, int current_level, int motor_state);
int fault_is_critical(int fault_code);
const char *fault_to_string(int fault_code);

#endif /* FAULT_H */
