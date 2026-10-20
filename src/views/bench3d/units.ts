// Scene units and axis convention for the 3D bench.
//
//   1 scene unit = 1 cm.
//   y is UP. The bench table top is the y = 0 plane (things sit on it with their base at y = 0).
//   x runs LEFT -> RIGHT as in leaflet Fig. 2 (choke at far left, multimeter at far right).
//   z runs from the BACK of the table (negative) towards the VIEWER (positive). Seen from above (the 'top' preset),
//   +x is right and +z is down the screen, i.e. the same orientation as the printed top view in Fig. 2.
//   The optical axis of the lamp and the compact arrangement is the line z = AXIS_Z, y = AXIS_Y, along +x.
//
// Fig. 2 is drawn at about 0.11 cm per figure pixel; the layout below follows it.

export const CM = 1
export const MM = 0.1

/** Table slab: top face at y = 0. */
export const TABLE = { x: 0, z: 5, width: 120, depth: 70, thickness: 3 } as const

/** Optical axis of the lamp + compact arrangement. */
export const AXIS_Y = 4.5
export const AXIS_Z = -1.5

/** Radians for a rotation about y that turns local +x towards the world direction (dx, dz). */
export const yawToward = (dx: number, dz: number): number => Math.atan2(-dz, dx)

export const DEG = Math.PI / 180

export const units = { CM, MM, DEG, TABLE, AXIS_Y, AXIS_Z, yawToward } as const
export type Units = typeof units
