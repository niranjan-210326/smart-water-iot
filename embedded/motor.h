#ifndef MOTOR_H
#define MOTOR_H

#ifndef SIMULATION_MODE
#define SIMULATION_MODE 1
#endif

void motor_init(void);
void motor_on(void);
void motor_off(void);
int get_motor_state(void);
void motor_cleanup(void);

#endif /* MOTOR_H */
