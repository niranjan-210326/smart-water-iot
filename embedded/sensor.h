#ifndef SENSOR_H
#define SENSOR_H

#include "config.h"

void sensor_init(void);
int get_water_level(void);
void sensor_cleanup(void);

#endif /* SENSOR_H */
