import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Actor } from '../entities/actor.entity';

@Injectable()
export class ActorsService {
  constructor(
    @InjectRepository(Actor)
    private readonly actorRepository: Repository<Actor>,
  ) {}

  /**
   * Гарантирует наличие записи актора в локальной БД.
   * Если актора с таким id нет, атомарно создаёт его (upsert / on conflict do update).
   */
  async ensureActorExists(
    actorId: number,
    manager?: EntityManager,
  ): Promise<Actor> {
    const mgr = manager || this.actorRepository.manager;

    await mgr.query(
      `INSERT INTO actors (id, created_at, last_seen_at)
       VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP`,
      [actorId],
    );

    const repo = manager ? manager.getRepository(Actor) : this.actorRepository;
    return repo.findOneByOrFail({ id: actorId });
  }

  async findOne(id: number, manager?: EntityManager): Promise<Actor | null> {
    const repo = manager ? manager.getRepository(Actor) : this.actorRepository;
    return repo.findOneBy({ id });
  }
}
