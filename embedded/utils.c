#include "utils.h"

#include <stdio.h>
#include <string.h>
#include <time.h>

static const char *COMMAND_FILE_PATH = "../data/command.json";

static void set_default_command(char *mode, char *motor_cmd) {
    if (mode != NULL) {
        (void)snprintf(mode, COMMAND_MODE_MAX_LEN, "AUTO");
    }
    if (motor_cmd != NULL) {
        (void)snprintf(motor_cmd, COMMAND_MOTOR_MAX_LEN, "OFF");
    }
}

void read_command(char *mode, char *motor_cmd) {
    char buffer[512] = {0};
    char line[128];
    char parsed[COMMAND_MODE_MAX_LEN];
    char *match = NULL;
    FILE *file = NULL;

    set_default_command(mode, motor_cmd);

    if (mode == NULL || motor_cmd == NULL) {
        return;
    }

    file = fopen(COMMAND_FILE_PATH, "r");
    if (file == NULL) {
        return;
    }

    while (fgets(line, sizeof(line), file) != NULL) {
        if ((strlen(buffer) + strlen(line)) < (sizeof(buffer) - 1)) {
            (void)strcat(buffer, line);
        }
    }
    fclose(file);

    match = strstr(buffer, "\"mode\"");
    if (match != NULL && sscanf(match, "\"mode\"%*[^\"\n]\"%15[^\"]\"", parsed) == 1) {
        if (strcmp(parsed, "AUTO") == 0 || strcmp(parsed, "MANUAL") == 0) {
            (void)snprintf(mode, COMMAND_MODE_MAX_LEN, "%s", parsed);
        }
    }

    match = strstr(buffer, "\"motor\"");
    if (match != NULL && sscanf(match, "\"motor\"%*[^\"\n]\"%15[^\"]\"", parsed) == 1) {
        if (strcmp(parsed, "ON") == 0 || strcmp(parsed, "OFF") == 0) {
            (void)snprintf(motor_cmd, COMMAND_MOTOR_MAX_LEN, "%s", parsed);
        }
    }
}

void get_current_timestamp(char *buffer, int buffer_size) {
    time_t now = time(NULL);
    struct tm *local = localtime(&now);

    if (buffer == NULL || buffer_size <= 0) {
        return;
    }

    if (local == NULL) {
        buffer[0] = '\0';
        return;
    }

    (void)strftime(buffer, (size_t)buffer_size, "%Y-%m-%d %H:%M:%S", local);
}

int write_status_json(const char *path,
                      int water_level,
                      int motor_state,
                      const char *mode,
                      const char *fault,
                      const char *timestamp) {
    FILE *file = fopen(path, "w");

    if (file == NULL) {
        return -1;
    }

    if (fprintf(file,
                "{\n"
                "  \"water_level\": %d,\n"
                "  \"motor\": %d,\n"
                "  \"mode\": \"%s\",\n"
                "  \"fault\": \"%s\",\n"
                "  \"timestamp\": \"%s\"\n"
                "}\n",
                water_level,
                motor_state,
                mode,
                fault,
                timestamp) < 0) {
        fclose(file);
        return -1;
    }

    fclose(file);
    return 0;
}
