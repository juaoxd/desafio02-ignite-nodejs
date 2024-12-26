import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getUserBySessionId } from '../middlewares/get-user-by-session-id'
import { knex } from '../database'

export async function mealsRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: [getUserBySessionId] }, async (req, reply) => {
    const createMealBodySchema = z.object({
      name: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      onDiet: z.boolean(),
    })

    const { name, description, date, onDiet } = createMealBodySchema.parse(
      req.body,
    )

    const userId = req.user!.id

    await knex('meals').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      name,
      description,
      date: new Date(date),
      on_diet: onDiet,
    })

    return reply.status(201).send()
  })

  app.get('/', { preHandler: [getUserBySessionId] }, async (req, reply) => {
    const userId = req.user!.id

    const meals = await knex('meals').where('user_id', userId).select()

    return reply.send(meals)
  })

  app.get(
    '/:mealId',
    { preHandler: [getUserBySessionId] },
    async (req, reply) => {
      const userId = req.user!.id

      const getMealByIdParamsSchema = z.object({
        mealId: z.string().uuid(),
      })

      const { mealId } = getMealByIdParamsSchema.parse(req.params)

      const meal = await knex('meals')
        .where('user_id', userId)
        .andWhere('id', mealId)
        .first()

      if (!meal) {
        return reply.status(400).send({ error: 'bad request' })
      }

      return reply.send(meal)
    },
  )

  app.delete(
    '/:mealId',
    { preHandler: [getUserBySessionId] },
    async (req, reply) => {
      const userId = req.user!.id

      const deleteMealParamsSchema = z.object({
        mealId: z.string().uuid(),
      })

      const { mealId } = deleteMealParamsSchema.parse(req.params)

      const result = await knex('meals')
        .where('user_id', userId)
        .andWhere('id', mealId)
        .delete()

      // result = 0 or 1 / 0 fail - 1 success
      if (!result) {
        return reply.status(400).send({ error: 'bad request' })
      }

      return reply.status(204).send()
    },
  )

  app.put(
    '/:mealId',
    { preHandler: [getUserBySessionId] },
    async (req, reply) => {
      const userId = req.user!.id

      const updateMealParamsSchema = z.object({
        mealId: z.string().uuid(),
      })

      const updateMealBodySchema = z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        date: z.coerce.date().optional(),
        onDiet: z.boolean().optional(),
      })

      const { mealId } = updateMealParamsSchema.parse(req.params)

      const meal = await knex('meals')
        .where('user_id', userId)
        .andWhere('id', mealId)
        .first()

      if (!meal) {
        return reply.status(400).send({ error: 'bad request, meal not found' })
      }

      const { name, description, date, onDiet } = updateMealBodySchema.parse(
        req.body,
      )

      await knex('meals')
        .where('user_id', userId)
        .andWhere('id', mealId)
        .update({
          name,
          description,
          date,
          on_diet: onDiet,
        })

      return reply.status(204).send()
    },
  )

  app.get(
    '/metrics',
    { preHandler: [getUserBySessionId] },
    async (req, reply) => {
      const userId = req.user!.id

      const totalMeals = await knex('meals')
        .where('user_id', userId)
        .count('id', { as: 'count' })
        .first()

      const onDietMeals = await knex('meals')
        .where('user_id', userId)
        .andWhere('on_diet', true)
        .count('id', { as: 'count' })
        .first()

      const offDietMeals = await knex('meals')
        .where('user_id', userId)
        .andWhere('on_diet', false)
        .count('id', { as: 'count' })
        .first()

      const bestOnDietStreak = await knex('meals')
        .where('user_id', userId)
        .orderBy('date', 'desc')
        .select()

      let currentStreak = 0
      let longestStreak = 0

      for (const meal of bestOnDietStreak) {
        if (meal.on_diet) {
          currentStreak++
        } else {
          longestStreak = Math.max(longestStreak, currentStreak)
          currentStreak = 0
        }
      }

      longestStreak = Math.max(longestStreak, currentStreak)

      return reply.send({
        totalMeals: totalMeals?.count,
        onDietMeals: onDietMeals?.count,
        offDietMeals: offDietMeals?.count,
        longestStreak,
      })
    },
  )
}
