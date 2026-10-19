import asyncio
import certifi
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv('item1.env')

async def main():
    uri = os.getenv("MONGODB_URI")
    print("Connecting with tlsCAFile=certifi.where():", certifi.where())
    client = AsyncIOMotorClient(
        uri,
        tlsCAFile=certifi.where()
    )
    result = await client.admin.command('ping')
    print("Direct Ping Result:", result)

if __name__ == "__main__":
    asyncio.run(main())
