#ifndef FAULT_H
#define FAULT_H

#define FAULT_NONE 0
#define FAULT_DRY_RUN 1
#define FAULT_EMPTY_SUMP 2

int detect_fault(int prev_level, int current_level, int motor_state);
const char *fault_to_string(int fault_code);

#endif /* FAULT_H */
