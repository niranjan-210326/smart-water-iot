#ifndef MOTOR_H
#define MOTOR_H

#include "config.h"

void motor_init(void);
void motor_on(void);
void motor_off(void);
int get_motor_state(void);
void motor_cleanup(void);

#endif /* MOTOR_H */
