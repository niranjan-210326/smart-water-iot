#ifndef UTILS_H
#define UTILS_H

#define COMMAND_MODE_MAX_LEN 16
#define COMMAND_MOTOR_MAX_LEN 16
#define TIMESTAMP_BUFFER_SIZE 20

void get_current_timestamp(char *buffer, int buffer_size);
void read_command(char *mode, char *motor_cmd);
int write_status_json(const char *path,
                      int water_level,
                      int motor_state,
                      const char *mode,
                      const char *fault,
                      const char *timestamp);

#endif /* UTILS_H */
