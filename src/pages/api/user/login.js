import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { jwtConfig } from 'src/configs/auth'
import prisma from '../../../../lib/prisma'

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const data = req.body

      // Find the user by username and include related data
      const user = await prisma.users.findUnique({
        where: {
          user_name: data.username
        },
        include: {
          accounts: true,
          deposits: true,
          reward_clicks: true
        }
      })

      // Check if a user with the provided username exists
      if (!user) {
        return res.status(401).json({ message: 'User not found' })
      }

      const passwordMatch = await bcrypt.compare(data.password, user.password)

      if (!passwordMatch) {
        return res.status(401).json({ message: 'Invalid Password' })
      }

      // Find the latest user referred by the current user
      const refs = await prisma.users.findFirst({
        where: {
          ref_by: user.user_name
        },
        include: {
          accounts: true
        },
        orderBy: {
          created_at: 'desc'
        }
      })

      if (refs !== null) {
        const latestUser = refs
        const created_at = new Date(latestUser.created_at)
        const today = new Date()
        const diffTime = Math.abs(today - created_at)
        const lastUserReferred = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        const accessToken = signAccessToken(user, lastUserReferred)

        return res.status(200).json({ accessToken, user: { ...user, lastUserReferred } })
      }

      const accessToken = signAccessToken(user)

      return res.status(200).json({ accessToken, user: { ...user, role: 'admin' } })
    } catch (error) {
      console.error('Error:', error)

      return res.status(500).json({ message: error.message })
    } finally {
      await prisma.$disconnect()
    }
  }

  return res.status(405).json({ message: 'Method not allowed' })
}

// Helper function to sign JWT tokens
function signAccessToken(user, lastUserReferred = null) {
  return jwt.sign(
    { ...user, lastUserReferred },
    jwtConfig.secret, // Replace with your secret key
    { expiresIn: jwtConfig.expirationTime } // Token expiration time
  )
}

// Extend BigInt prototype (if needed)
BigInt.prototype.toJSON = function () {
  return this.toString()
}
