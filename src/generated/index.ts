/* eslint-disable */
import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import type { AppContext } from '../types.js';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  Date: any;
  Object: any;
};

export type Entry = {
  __typename?: 'Entry';
  content?: Maybe<Scalars['String']>;
  date: Scalars['Date'];
  extra: Scalars['Object'];
  filepath: Scalars['String'];
  permalink: Scalars['String'];
  publish: Scalars['Boolean'];
  slug: Scalars['String'];
  tags: Array<Scalars['String']>;
  title: Scalars['String'];
  type: Scalars['String'];
};

export type Filter = {
  content?: InputMaybe<Scalars['String']>;
  date?: InputMaybe<Scalars['Date']>;
  filepath?: InputMaybe<Scalars['String']>;
  permalink?: InputMaybe<Scalars['String']>;
  publish?: InputMaybe<Scalars['Boolean']>;
  slug?: InputMaybe<Scalars['String']>;
  tags?: InputMaybe<Array<Scalars['String']>>;
  title?: InputMaybe<Scalars['String']>;
  type?: InputMaybe<Scalars['String']>;
};

export type Query = {
  __typename?: 'Query';
  entries?: Maybe<Array<Entry>>;
  routesInfo: Routes;
  serverReady: Scalars['Boolean'];
};


export type QueryEntriesArgs = {
  input?: InputMaybe<QueryInput>;
};


export type QueryRoutesInfoArgs = {
  input?: InputMaybe<QueryInput>;
};

export type QueryInput = {
  exists?: InputMaybe<Array<Scalars['String']>>;
  filter?: InputMaybe<Filter>;
  limit?: InputMaybe<Scalars['Int']>;
  matches?: InputMaybe<Scalars['Object']>;
  offset?: InputMaybe<Scalars['Int']>;
};

export type Routes = {
  __typename?: 'Routes';
  count?: Maybe<Scalars['Int']>;
  tags: Array<TagInfo>;
};

export type TagInfo = {
  __typename?: 'TagInfo';
  count: Scalars['Int'];
  name: Scalars['String'];
  slug: Scalars['String'];
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  Boolean: ResolverTypeWrapper<Scalars['Boolean']>;
  Date: ResolverTypeWrapper<Scalars['Date']>;
  Entry: ResolverTypeWrapper<Entry>;
  Filter: Filter;
  Int: ResolverTypeWrapper<Scalars['Int']>;
  Object: ResolverTypeWrapper<Scalars['Object']>;
  Query: ResolverTypeWrapper<{}>;
  QueryInput: QueryInput;
  Routes: ResolverTypeWrapper<Routes>;
  String: ResolverTypeWrapper<Scalars['String']>;
  TagInfo: ResolverTypeWrapper<TagInfo>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Boolean: Scalars['Boolean'];
  Date: Scalars['Date'];
  Entry: Entry;
  Filter: Filter;
  Int: Scalars['Int'];
  Object: Scalars['Object'];
  Query: {};
  QueryInput: QueryInput;
  Routes: Routes;
  String: Scalars['String'];
  TagInfo: TagInfo;
}>;

export interface DateScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Date'], any> {
  name: 'Date';
}

export type EntryResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Entry'] = ResolversParentTypes['Entry']> = ResolversObject<{
  content?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  date?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  extra?: Resolver<ResolversTypes['Object'], ParentType, ContextType>;
  filepath?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  permalink?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  publish?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  slug?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  tags?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface ObjectScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Object'], any> {
  name: 'Object';
}

export type QueryResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  entries?: Resolver<Maybe<Array<ResolversTypes['Entry']>>, ParentType, ContextType, Partial<QueryEntriesArgs>>;
  routesInfo?: Resolver<ResolversTypes['Routes'], ParentType, ContextType, Partial<QueryRoutesInfoArgs>>;
  serverReady?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
}>;

export type RoutesResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['Routes'] = ResolversParentTypes['Routes']> = ResolversObject<{
  count?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  tags?: Resolver<Array<ResolversTypes['TagInfo']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TagInfoResolvers<ContextType = AppContext, ParentType extends ResolversParentTypes['TagInfo'] = ResolversParentTypes['TagInfo']> = ResolversObject<{
  count?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  slug?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type Resolvers<ContextType = AppContext> = ResolversObject<{
  Date?: GraphQLScalarType;
  Entry?: EntryResolvers<ContextType>;
  Object?: GraphQLScalarType;
  Query?: QueryResolvers<ContextType>;
  Routes?: RoutesResolvers<ContextType>;
  TagInfo?: TagInfoResolvers<ContextType>;
}>;

